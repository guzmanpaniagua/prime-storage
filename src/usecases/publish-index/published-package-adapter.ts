import { PublishIndexError } from "./publish-index-error.js";
import type { PublishIndexStore } from "./publish-index-store.js";
import type {
  PhaseType,
  PublishIndexEntry,
} from "./publish-index-types.js";

/**
 * Adaptador temporal (issue 24): sustituye a
 * GitHubPublicationService.getPublishedPackageArchive() usando PublishIndexStore.
 *
 * Mapeo de situaciones (equivalencia funcional con el monolito):
 * - packageId inválido  → INVALID_PACKAGE_ID (monolito: ApiError 400)
 * - package inexistente → PACKAGE_NOT_FOUND (monolito: ApiError 404)
 * - archive inexistente → PACKAGE_ARCHIVE_MISSING
 * - error de integridad → ARCHIVE_INTEGRITY_ERROR (lanzado por el store)
 */
export interface PublishedPackage {
  entry: PublishIndexEntry;
  bytes: Uint8Array;
}

export async function publishedPackageFromStore(
  store: PublishIndexStore,
  phase: PhaseType,
  packageId: number
): Promise<PublishedPackage> {
  if (!Number.isSafeInteger(packageId) || packageId < 1) {
    throw new PublishIndexError(
      "INVALID_PACKAGE_ID",
      `packageId must be a positive safe integer (received ${packageId}).`
    );
  }

  const entry = await store.getPublishedPackage(phase, packageId);
  if (!entry) {
    throw new PublishIndexError(
      "PACKAGE_NOT_FOUND",
      `Package ${packageId} was not found in the published index of phase ${phase}.`
    );
  }

  const bytes = await store.getPublishedArchive(phase, packageId);
  if (!bytes) {
    throw new PublishIndexError(
      "PACKAGE_ARCHIVE_MISSING",
      `The archive for package ${packageId} in phase ${phase} is missing.`
    );
  }

  return { entry, bytes };
}
