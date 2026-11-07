import type { GithubArtifactStorage } from "../../github/github-artifact-storage.js";
import type { PublishIndexStore } from "./publish-index-store.js";
import {
  loadArchive,
  loadIndex,
  archiveReference,
  indexReference,
  persistWrites,
  persistMissingWrites,
  sameEntry,
  buildEntry,
  validatePublishInput,
  verifyArchive,
  archiveExists,
} from "./publish-index-core.js";
import { PublishIndexError } from "./publish-index-error.js";
import type {
  PhaseType,
  PublishIndex,
  PublishIndexEntry,
  PublishPackageInput,
  PublishPackageResult,
} from "./publish-index-types.js";

export class GithubPublishIndexStore implements PublishIndexStore {
  private readonly storage: GithubArtifactStorage;

  constructor(storage: GithubArtifactStorage) {
    this.storage = storage;
  }

  async getPublishedPackages(
    phase: PhaseType
  ): Promise<readonly PublishIndexEntry[]> {
    return (await loadIndex(this.storage, phase)).packages;
  }

  async getPublishedPackage(
    phase: PhaseType,
    packageId: number
  ): Promise<PublishIndexEntry | null> {
    const index = await loadIndex(this.storage, phase);
    return index.packages.find((entry) => entry.packageId === packageId) ?? null;
  }

  async getPublishedArchive(
    phase: PhaseType,
    packageId: number
  ): Promise<Uint8Array | null> {
    const entry = await this.getPublishedPackage(phase, packageId);
    if (!entry) return null;

    const archive = await loadArchive(this.storage, phase, entry);
    if (!archive) return null;

    verifyArchive(entry, archive);
    return archive;
  }

  async registerPublishedPackage(
    input: PublishPackageInput
  ): Promise<PublishPackageResult> {
    validatePublishInput(input);

    const index = await loadIndex(this.storage, input.phase);
    const existing = index.packages.find(
      (candidate) => candidate.packageId === input.packageId
    );

    const incomingEntry = buildEntry(input);

    if (existing) {
      if (sameEntry(existing, incomingEntry)) {
        if (input.additionalArtifacts?.length) {
          await persistMissingWrites(
            this.storage,
            input.additionalArtifacts,
            `Repair package ${input.packageId} related artifacts in ${input.phase}`
          );
        }
        return { status: "already-published", entry: existing, index };
      }
      throw new PublishIndexError(
        "PACKAGE_CONFLICT",
        `Package ${input.packageId} is already published in phase ${input.phase} with different content.`
      );
    }

    const updatedIndex: PublishIndex = {
      phase: input.phase,
      packages: [...index.packages, incomingEntry].sort(
        (a, b) => a.packageId - b.packageId
      ),
    };
    if (await archiveExists(this.storage, input.phase, incomingEntry)) {
      throw new PublishIndexError(
        "ARCHIVE_EXISTS_UNINDEXED",
        `Archive ${incomingEntry.filename} already exists in phase ${input.phase} but is not listed in the publish index.`
      );
    }
    await persistWrites(
      this.storage,
      [
        {
          reference: archiveReference(input.phase, incomingEntry),
          data: input.archive,
          metadata: { type: `publish-archive-${input.phase.toLowerCase()}`, version: "1.0.0" },
        },
        {
          reference: indexReference(input.phase),
          data: updatedIndex,
          metadata: { type: `publish-index-${input.phase.toLowerCase()}`, version: "1.0.0" },
        },
        ...(input.additionalArtifacts ?? []),
      ],
      `Publish package ${input.packageId} in ${input.phase}`
    );

    return { status: "registered", entry: incomingEntry, index: updatedIndex };
  }

  async verifyPublishedArchive(
    phase: PhaseType,
    packageId: number
  ): Promise<void> {
    const entry = await this.getPublishedPackage(phase, packageId);
    if (!entry) {
      throw new PublishIndexError(
        "PACKAGE_NOT_FOUND",
        `Package ${packageId} is not published in phase ${phase}.`
      );
    }

    const archive = await loadArchive(this.storage, phase, entry);
    if (!archive) {
      throw new PublishIndexError(
        "PACKAGE_ARCHIVE_MISSING",
        `Archive ${entry.filename} for package ${packageId} is missing in phase ${phase}.`
      );
    }

    verifyArchive(entry, archive);
  }
}
