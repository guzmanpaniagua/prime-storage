import { createHash } from "node:crypto";
import type { ArtifactReference, ArtifactStorage, ArtifactWrite } from "../../contracts/artifact-storage.js";
import { CampaignCheckpointError } from "./campaign-checkpoint-error.js";
import type {
  CampaignArtifactReference,
  CampaignCheckpointPointer,
  CampaignCheckpointSnapshot,
} from "./campaign-checkpoint-types.js";
import { phaseFolder } from "../publish-index/publish-index-core.js";
import type { PhaseType, PublishIndex } from "../publish-index/publish-index-types.js";
import type { PackageCheckpointEntry, PackageCheckpointFile } from "./campaign-checkpoint-types.js";
import { isStorageNotFoundError } from "../../utils/storage-errors.js";

/**
 * Raíz física de una campaña dentro del repositorio.
 * Debe coincidir con la convención histórica: campaigns/<campaignId>.
 */
export function campaignRoot(campaignId: string): string {
  return `campaigns/${campaignId}`;
}

/** Ruta determinista del snapshot para una secuencia. */
export function checkpointSnapshotPath(campaignId: string, sequence: number): string {
  return `${campaignRoot(campaignId)}/state/snapshots/checkpoint-${String(sequence).padStart(6, "0")}.json`;
}

/** Referencia física del puntero latest de una campaña. */
export function pointerReference(campaignId: string): ArtifactReference {
  return {
    id: `campaign-checkpoint-latest-${campaignId}`,
    path: `${campaignRoot(campaignId)}/state/latest.json`,
  };
}

/** Referencia física de un snapshot inmutable por secuencia. */
export function snapshotReference(campaignId: string, sequence: number): ArtifactReference {
  return {
    id: `campaign-checkpoint-snapshot-${campaignId}-${sequence}`,
    path: checkpointSnapshotPath(campaignId, sequence),
  };
}

/** Referencia física del artefacto (ZIP) del checkpoint. */
export function artifactReference(archivePath: string): ArtifactReference {
  return { id: `campaign-artifact-${archivePath}`, path: archivePath };
}

export async function loadCampaignArtifact(
  storage: ArtifactStorage,
  reference: CampaignArtifactReference
): Promise<Uint8Array> {
  let content: unknown;
  try {
    content = await storage.load(artifactReference(reference.path));
  } catch (error) {
    if (!isStorageNotFoundError(error)) throw error;
    throw new CampaignCheckpointError(
      "CHECKPOINT_ARCHIVE_NOT_FOUND",
      "No se encontró el artefacto asociado al checkpoint."
    );
  }

  if (!(content instanceof Uint8Array)) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_ARCHIVE_INVALID",
      "El artefacto asociado al checkpoint no es binario."
    );
  }
  if (content.byteLength !== reference.sizeBytes || sha256Of(content) !== reference.sha256) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_ARCHIVE_HASH_MISMATCH",
      "El artefacto no coincide con el tamaño o SHA-256 del checkpoint."
    );
  }
  return content;
}

export async function persistCheckpointWrites(
  storage: ArtifactStorage,
  writes: readonly ArtifactWrite[],
  message: string
): Promise<void> {
  const paths = new Set<string>();
  for (const { reference } of writes) {
    if (paths.has(reference.path)) {
      throw new CampaignCheckpointError(
        "CHECKPOINT_INVALID",
        `A checkpoint batch cannot write the same path more than once: ${reference.path}.`
      );
    }
    paths.add(reference.path);
  }

  if (storage.saveManyAt) {
    await storage.saveManyAt(writes, message);
    return;
  }
  for (const write of writes) {
    await storage.saveAt(write.reference, write.data, write.metadata);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isPublishIndex(value: unknown, phase: string): boolean {
  if (!isRecord(value) || value.phase !== phase || !Array.isArray(value.packages)) {
    return false;
  }
  return value.packages.every((entry: unknown) =>
    isRecord(entry)
    && Number.isSafeInteger(entry.packageId) && (entry.packageId as number) >= 1
    && typeof entry.filename === "string"
    && isSha256(entry.sha256)
    && Number.isSafeInteger(entry.sizeBytes) && (entry.sizeBytes as number) >= 1
  );
}

function sha256Of(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function checkpointText(content: string | Uint8Array): string {
  if (typeof content === "string") return content;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "The package checkpoint contains invalid UTF-8."
    );
  }
}

/**
 * Validates the persisted pointer/snapshot pair bundled with a package.
 * Workflow-specific rules (allowed job types, campaign naming and prior
 * checkpoint continuity) remain the responsibility of the consuming app.
 */
export function validatePackageCheckpointArtifacts(input: {
  phase: PhaseType;
  entry: PackageCheckpointEntry;
  files: readonly PackageCheckpointFile[];
}): { pointer: CampaignCheckpointPointer; snapshot: CampaignCheckpointSnapshot; artifacts: ArtifactWrite[] } {
  const { phase, entry, files } = input;
  const snapshotName = `checkpoint-${String(entry.packageId).padStart(6, "0")}.json`;
  const pointerFile = files.find((file) => file.path.endsWith("/state/latest.json"));
  const snapshotFile = files.find((file) => file.path.endsWith(`/state/snapshots/${snapshotName}`));
  if (
    files.length !== 2
    || !pointerFile
    || !snapshotFile
    || pointerFile.path === snapshotFile.path
    || !Number.isSafeInteger(entry.packageId) || entry.packageId < 1
    || !Number.isSafeInteger(entry.lastLogicalBlock)
    || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 1
    || !isSha256(entry.sha256)
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "A package publication requires its latest pointer and immutable snapshot."
    );
  }

  let pointerValue: unknown;
  let snapshotValue: unknown;
  let snapshotText: string;
  try {
    pointerValue = JSON.parse(checkpointText(pointerFile.content)) as unknown;
    snapshotText = checkpointText(snapshotFile.content);
    snapshotValue = JSON.parse(snapshotText) as unknown;
  } catch (error) {
    if (error instanceof CampaignCheckpointError) throw error;
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "The package checkpoint pointer or snapshot is not valid JSON."
    );
  }

  if (!isRecord(pointerValue) || typeof pointerValue.campaignId !== "string" || !isRecord(snapshotValue)) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "The package checkpoint pointer or snapshot has an invalid structure."
    );
  }

  const campaignId = pointerValue.campaignId;
  const root = campaignRoot(campaignId);
  if (
    pointerFile.path !== `${root}/state/latest.json`
    || snapshotFile.path !== checkpointSnapshotPath(campaignId, entry.packageId)
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "The package checkpoint paths do not match its campaign and sequence."
    );
  }

  const pointer = parsePointer(campaignId, pointerValue);
  const snapshot = snapshotValue as unknown as CampaignCheckpointSnapshot;
  validateSnapshot(snapshot);
  verifySnapshotAgainstPointer(campaignId, pointer, snapshot);

  const indexedEntry = snapshot.packageIndex.packages.find((item) => item.packageId === entry.packageId);
  if (
    pointer.sequence !== entry.packageId
    || snapshot.phase !== phase
    || snapshot.sequence !== entry.packageId
    || snapshot.lastPublishedPackageId !== entry.packageId
    || snapshot.lastPublishedLogicalBlock !== entry.lastLogicalBlock
    || snapshot.nextLogicalBlockToPublish !== entry.lastLogicalBlock + 1
    || snapshot.artifact.kind !== "PUBLISHED_PACKAGE"
    || snapshot.artifact.packageId !== entry.packageId
    || snapshot.artifact.path !== `${phaseFolder(phase)}/${entry.filename}`
    || snapshot.artifact.sha256 !== entry.sha256
    || snapshot.artifact.sizeBytes !== entry.sizeBytes
    || !indexedEntry
    || indexedEntry.filename !== entry.filename
    || indexedEntry.sha256 !== entry.sha256
    || indexedEntry.sizeBytes !== entry.sizeBytes
    || pointer.snapshotSha256 !== sha256Of(snapshotFile.content)
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "The package checkpoint does not match the package being published."
    );
  }

  const artifacts: ArtifactWrite[] = files.map((file) => {
    const isPointer = file === pointerFile;
    return {
      reference: { id: `campaign-checkpoint-${file.path}`, path: file.path },
      data: isPointer ? pointerValue : snapshotText,
      metadata: {
        type: isPointer ? "campaign-checkpoint-latest" : "campaign-checkpoint-snapshot",
        version: "1.0.0",
      },
    };
  });
  return { pointer, snapshot, artifacts };
}

/** Serialización física del snapshot: base del hash registrado en el puntero. */
export function serializeSnapshot(snapshot: CampaignCheckpointSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/** Construye el puntero latest a partir del snapshot publicado. */
export function buildPointer(
  snapshot: CampaignCheckpointSnapshot,
  snapshotPath: string,
  snapshotSha256: string
): CampaignCheckpointPointer {
  return {
    schemaVersion: "1.0.0",
    campaignId: snapshot.campaignId,
    sequence: snapshot.sequence,
    snapshotPath,
    snapshotSha256,
    lastPublishedPackageId: snapshot.lastPublishedPackageId,
    lastPublishedLogicalBlock: snapshot.lastPublishedLogicalBlock,
    nextLogicalBlockToPublish: snapshot.nextLogicalBlockToPublish,
    jobId: snapshot.jobId,
    jobType: snapshot.jobType,
  };
}

/**
 * Valida el contrato de negocio del snapshot y sus referencias.
 * Equivalente a las validaciones de getCampaignCheckpoint() del monolito,
 * excluida la comparación con el índice remoto de fase.
 */
export function validateSnapshot(snapshot: CampaignCheckpointSnapshot): void {
  if (
    snapshot.schemaVersion !== "1.0.0"
    || snapshot.kind !== "campaign-checkpoint"
    || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1
    || typeof snapshot.jobId !== "string"
    || typeof snapshot.jobType !== "string"
    || !isRecord(snapshot.jobState)
    || !isPublishIndex(snapshot.packageIndex, snapshot.phase)
    || !isRecord(snapshot.artifact)
    || typeof snapshot.artifact.path !== "string"
    || !isSha256(snapshot.artifact.sha256)
    || !Number.isSafeInteger(snapshot.artifact.sizeBytes) || snapshot.artifact.sizeBytes < 1
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "El snapshot de campaña incumple el contrato o sus referencias."
    );
  }
}

/**
 * Valida la entrada de publicación: contrato del snapshot, coincidencia
 * del artefacto (ruta, tamaño, hash) y ubicación dentro de su campaña.
 */
export function validatePublishInput(
  snapshot: CampaignCheckpointSnapshot,
  archive: Uint8Array,
  archivePath: string
): void {
  const root = campaignRoot(snapshot.campaignId);
  if (
    snapshot.schemaVersion !== "1.0.0"
    || snapshot.kind !== "campaign-checkpoint"
    || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1
    || snapshot.artifact.path !== archivePath
    || !archivePath.startsWith(`${root}/`)
    || snapshot.artifact.sizeBytes !== archive.byteLength
    || snapshot.artifact.sha256 !== sha256Of(archive)
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "El artefacto o la metadata del checkpoint no coinciden."
    );
  }
  validateSnapshot(snapshot);
}

/**
 * Valida el puntero vigente leído de latest.json contra el contrato.
 * Devuelve el puntero tipado o null si no existe checkpoint previo.
 */
export function parsePointer(
  campaignId: string,
  raw: unknown
): CampaignCheckpointPointer {
  const root = campaignRoot(campaignId);
  if (
    !isRecord(raw)
    || raw.schemaVersion !== "1.0.0"
    || raw.campaignId !== campaignId
    || !Number.isSafeInteger(raw.sequence) || (raw.sequence as number) < 1
    || raw.snapshotPath !== checkpointSnapshotPath(campaignId, raw.sequence as number)
    || !isSha256(raw.snapshotSha256)
    || !Number.isSafeInteger(raw.lastPublishedPackageId)
    || !Number.isSafeInteger(raw.lastPublishedLogicalBlock)
    || !Number.isSafeInteger(raw.nextLogicalBlockToPublish)
    || typeof raw.jobId !== "string"
    || typeof raw.jobType !== "string"
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "El puntero latest del checkpoint incumple el contrato."
    );
  }
  return raw as unknown as CampaignCheckpointPointer;
}

/**
 * Valida el snapshot leído y su coherencia con el puntero:
 * identidad, cursores, hash y referencias del artefacto.
 */
export function verifySnapshotAgainstPointer(
  campaignId: string,
  pointer: CampaignCheckpointPointer,
  snapshot: CampaignCheckpointSnapshot
): void {
  if (
    snapshot.schemaVersion !== "1.0.0"
    || snapshot.kind !== "campaign-checkpoint"
    || snapshot.campaignId !== campaignId
    || snapshot.sequence !== pointer.sequence
    || snapshot.jobId !== pointer.jobId
    || snapshot.jobType !== pointer.jobType
    || snapshot.lastPublishedPackageId !== pointer.lastPublishedPackageId
    || snapshot.lastPublishedLogicalBlock !== pointer.lastPublishedLogicalBlock
    || snapshot.nextLogicalBlockToPublish !== pointer.nextLogicalBlockToPublish
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "El snapshot de campaña incumple el contrato o sus referencias."
    );
  }
  if (snapshot.artifact.kind === "RECOVERY_RESULTS_ARCHIVE") {
    if (!snapshot.artifact.path.startsWith(`${campaignRoot(campaignId)}/recovery/`)) {
      throw new CampaignCheckpointError(
        "CHECKPOINT_INVALID",
        "El bundle de recuperación debe estar dentro de la carpeta de su campaña."
      );
    }
  } else if (snapshot.artifact.kind === "PUBLISHED_PACKAGE") {
    const packageEntry = snapshot.packageIndex.packages.find(
      (entry) => entry.packageId === snapshot.artifact.packageId
    );
    if (
      !packageEntry
      || snapshot.artifact.path !== `${phaseFolder(snapshot.phase)}/${packageEntry.filename}`
      || snapshot.artifact.sha256 !== packageEntry.sha256
      || snapshot.artifact.sizeBytes !== packageEntry.sizeBytes
    ) {
      throw new CampaignCheckpointError(
        "CHECKPOINT_INVALID",
        "El ZIP referenciado no coincide con el índice de paquetes."
      );
    }
  } else {
    throw new CampaignCheckpointError(
      "CHECKPOINT_INVALID",
      "El tipo de artefacto del checkpoint no está soportado."
    );
  }
}

/** Verifica que el contenido del snapshot coincide con el hash del puntero. */
export function verifySnapshotHash(snapshotText: string, pointer: CampaignCheckpointPointer): void {
  if (sha256Of(snapshotText) !== pointer.snapshotSha256) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_HASH_MISMATCH",
      "El snapshot no coincide con el SHA-256 del puntero latest."
    );
  }
}

/** Verifica la integridad del artefacto descargado contra el checkpoint. */
export function verifyArtifact(
  snapshot: CampaignCheckpointSnapshot,
  bytes: Uint8Array
): void {
  if (
    bytes.byteLength !== snapshot.artifact.sizeBytes
    || sha256Of(bytes) !== snapshot.artifact.sha256
  ) {
    throw new CampaignCheckpointError(
      "CHECKPOINT_HASH_MISMATCH",
      "El artefacto descargado no coincide con el tamaño o SHA-256 del checkpoint."
    );
  }
}

/**
 * Regla de avance de secuencia: el nuevo checkpoint debe avanzar
 * estrictamente la secuencia vigente.
 */
export function assertNewerSequence(
  prior: CampaignCheckpointPointer | null,
  snapshot: CampaignCheckpointSnapshot
): void {
  if (prior) {
    if (
      prior.campaignId !== snapshot.campaignId
      || !Number.isSafeInteger(prior.sequence)
      || prior.sequence >= snapshot.sequence
    ) {
      throw new CampaignCheckpointError(
        "CHECKPOINT_SEQUENCE_CONFLICT",
        "El checkpoint debe avanzar la secuencia vigente de la campaña."
      );
    }
  }
}

/**
 * Conflicto de rutas inmutables: snapshot o artefacto ya existen
 * con otro contenido (la secuencia es nueva).
 */
export async function assertImmutablePathsFree(
  storage: ArtifactStorage,
  snapshotPath: string,
  archivePath: string
): Promise<void> {
  for (const reference of [snapshotReferenceByPath(snapshotPath), artifactReference(archivePath)]) {
    try {
      await storage.getMetadata(reference);
    } catch (error) {
      if (!isStorageNotFoundError(error)) throw error;
      continue;
    }
    throw new CampaignCheckpointError(
      "CHECKPOINT_ARTIFACT_CONFLICT",
      "Ya existe una ruta inmutable del checkpoint con otro contenido."
    );
  }
}

function snapshotReferenceByPath(snapshotPath: string): ArtifactReference {
  return { id: `campaign-checkpoint-snapshot-${snapshotPath}`, path: snapshotPath };
}

/** Serialización física del puntero. */
export function serializePointer(pointer: CampaignCheckpointPointer): string {
  return JSON.stringify(pointer, null, 2);
}
