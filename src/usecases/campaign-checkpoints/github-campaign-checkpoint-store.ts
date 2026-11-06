import { createHash } from "node:crypto";
import type { GithubArtifactStorage } from "../../github/github-artifact-storage.js";
import {
  artifactReference,
  buildPointer,
  checkpointSnapshotPath,
  parsePointer,
  pointerReference,
  serializeSnapshot,
  snapshotReference,
  validatePublishInput,
  verifySnapshotAgainstPointer,
  verifySnapshotHash,
  assertNewerSequence,
  assertImmutablePathsFree,
} from "./campaign-checkpoint-core.js";
import { CampaignCheckpointError } from "./campaign-checkpoint-error.js";
import type { CampaignCheckpointStore } from "./campaign-checkpoint-store.js";
import type {
  CampaignCheckpointPointer,
  CampaignCheckpointSnapshot,
} from "./campaign-checkpoint-types.js";

/**
 * Implementación GitHub de CampaignCheckpointStore sobre GithubArtifactStorage.
 * Toda la lógica de negocio vive en campaign-checkpoint-core (100% compartida
 * con LocalCampaignCheckpointStore); esta clase solo orquesta lecturas y
 * escrituras. No depende de GithubClient.
 */
export class GithubCampaignCheckpointStore implements CampaignCheckpointStore {
  constructor(private readonly storage: GithubArtifactStorage) {}

  async getCheckpoint(campaignId: string): Promise<{
    pointer: CampaignCheckpointPointer;
    snapshot: CampaignCheckpointSnapshot;
  } | null> {
    let pointerRaw: unknown;
    try {
      pointerRaw = await this.storage.load(pointerReference(campaignId));
    } catch {
      return null; // Sin checkpoint vigente: no es un error.
    }
    const pointer = parsePointer(campaignId, pointerRaw);

    let snapshotText: string;
    try {
      const content = await this.storage.load(snapshotReference(campaignId, pointer.sequence));
      snapshotText = typeof content === "string"
        ? content
        : JSON.stringify(content, null, 2);
    } catch {
      throw new CampaignCheckpointError(
        "CHECKPOINT_HASH_MISMATCH",
        "El snapshot referenciado por latest no existe."
      );
    }
    verifySnapshotHash(snapshotText, pointer);

    let snapshot: CampaignCheckpointSnapshot;
    try {
      snapshot = JSON.parse(snapshotText) as CampaignCheckpointSnapshot;
    } catch {
      throw new CampaignCheckpointError(
        "CHECKPOINT_INVALID",
        "El snapshot no contiene JSON válido."
      );
    }
    verifySnapshotAgainstPointer(campaignId, pointer, snapshot);
    return { pointer, snapshot };
  }

  async publishCheckpoint(input: {
    snapshot: CampaignCheckpointSnapshot;
    archive: Uint8Array;
    archivePath: string;
  }): Promise<{
    pointer: CampaignCheckpointPointer;
    snapshotPath: string;
    snapshotSha256: string;
    alreadyPublished: boolean;
  }> {
    const { snapshot, archive, archivePath } = input;
    validatePublishInput(snapshot, archive, archivePath);

    const snapshotPath = checkpointSnapshotPath(snapshot.campaignId, snapshot.sequence);
    const snapshotContent = serializeSnapshot(snapshot);
    const snapshotSha256 = createHash("sha256").update(snapshotContent).digest("hex");
    const pointer = buildPointer(snapshot, snapshotPath, snapshotSha256);

    const prior = await this.getCheckpoint(snapshot.campaignId);
    if (prior) {
      if (prior.pointer.sequence === snapshot.sequence) {
        const existingArchive = await this.loadArchiveOrNull(archivePath);
        if (
          prior.pointer.snapshotSha256 === snapshotSha256
          && existingArchive !== null
          && Buffer.from(existingArchive).equals(Buffer.from(archive))
        ) {
          return { pointer, snapshotPath, snapshotSha256, alreadyPublished: true };
        }
        throw new CampaignCheckpointError(
          "CHECKPOINT_SEQUENCE_CONFLICT",
          "La secuencia del checkpoint ya existe con contenido diferente."
        );
      }
      assertNewerSequence(prior.pointer, snapshot);
    }
    await assertImmutablePathsFree(this.storage, snapshotPath, archivePath);

    await this.storage.saveAt(artifactReference(archivePath), archive, {
      type: "campaign-artifact",
      version: "1.0.0",
    });
    await this.storage.saveAt(snapshotReference(snapshot.campaignId, snapshot.sequence), snapshotContent, {
      type: "campaign-checkpoint-snapshot",
      version: "1.0.0",
    });
    await this.storage.saveAt(pointerReference(snapshot.campaignId), pointer, {
      type: "campaign-checkpoint-latest",
      version: "1.0.0",
    });
    return { pointer, snapshotPath, snapshotSha256, alreadyPublished: false };
  }

  private async loadArchiveOrNull(archivePath: string): Promise<Uint8Array | null> {
    try {
      const content = await this.storage.load(artifactReference(archivePath));
      return content instanceof Uint8Array ? content : null;
    } catch {
      return null;
    }
  }
}
