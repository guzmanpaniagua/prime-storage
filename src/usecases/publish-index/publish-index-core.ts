import { createHash } from "node:crypto";
import { isUint8Array } from "../../models/persisted-artifact-document.js";
import type { ArtifactStorage, ArtifactWrite } from "../../contracts/artifact-storage.js";
import { PublishIndexError } from "./publish-index-error.js";
import type {
  PhaseType,
  PublishIndex,
  PublishIndexEntry,
  PublishPackageInput,
  PublishPackageResult,
} from "./publish-index-types.js";

export const PHASE_PREFIXES: Record<PhaseType, string> = {
  PRIMES: "primes",
  PRODUCTS: "products",
  ANCHORS: "anchor",
  ANCHOR_SIEVE: "anchor-sieve",
  FACTORS: "factors",
  SMALL_CERTIFICATES: "small-certificates",
  SUCCESSIVE_SIEVES: "successive-sieves",
  FINAL_CERTIFICATION: "final-certificates",
};

export function emptyIndex(phase: PhaseType): PublishIndex {
  return { phase, packages: [] };
}

export function sameEntry(
  existing: PublishIndexEntry,
  incoming: PublishIndexEntry
): boolean {
  return existing.packageId === incoming.packageId
    && existing.filename === incoming.filename
    && existing.sha256 === incoming.sha256
    && existing.sizeBytes === incoming.sizeBytes
    && existing.firstLogicalBlock === incoming.firstLogicalBlock
    && existing.lastLogicalBlock === incoming.lastLogicalBlock
    && existing.blockSize === incoming.blockSize
    && existing.blockCount === incoming.blockCount
    && existing.generatorVersion === incoming.generatorVersion
    && existing.wheelVersion === incoming.wheelVersion;
  // publishedAt se excluye deliberadamente: no participa en la igualdad.
}

export const PHASE_FOLDERS: Record<PhaseType, string> = {
  PRIMES: "primes",
  PRODUCTS: "products",
  ANCHORS: "anchors",
  ANCHOR_SIEVE: "sieves/anchor-sieve",
  FACTORS: "factors",
  SMALL_CERTIFICATES: "certificates/small",
  SUCCESSIVE_SIEVES: "sieves/successive",
  FINAL_CERTIFICATION: "certificates/final",
};

export function phaseFolder(phase: PhaseType): string {
  return PHASE_FOLDERS[phase];
}

export function indexReference(phase: PhaseType) {
  return {
    id: `publish-index-${phase}`,
    path: `${phaseFolder(phase)}/publish-index.json`,
  };
}

export function archiveReference(phase: PhaseType, entry: PublishIndexEntry) {
  return {
    id: `publish-archive-${phase}-${entry.packageId}`,
    path: `${phaseFolder(phase)}/${entry.filename}`,
  };
}

export function validatePublishInput(input: PublishPackageInput): void {
  if (!Number.isSafeInteger(input.packageId) || input.packageId < 1) {
    throw new Error("packageId must be a positive integer.");
  }
  if (!(input.phase in PHASE_PREFIXES)) {
    throw new Error(`Unknown phase: ${String(input.phase)}.`);
  }
  if (
    !Number.isSafeInteger(input.blockRange.first) ||
    input.blockRange.first < 0
  ) {
    throw new Error("blockRange.first must be a non-negative integer.");
  }
  if (
    !Number.isSafeInteger(input.blockRange.size) ||
    input.blockRange.size < 1
  ) {
    throw new Error("blockRange.size must be a positive integer.");
  }
}

export function buildEntry(input: PublishPackageInput): PublishIndexEntry {
  const sha256 = createHash("sha256").update(input.archive).digest("hex");
  const lastLogicalBlock = input.blockRange.first + input.blockRange.size - 1;

  const entry: PublishIndexEntry = {
    packageId: input.packageId,
    filename: `${PHASE_PREFIXES[input.phase]}-pack-${String(input.packageId).padStart(6, "0")}.zip`,
    sha256,
    sizeBytes: input.archive.byteLength,
    firstLogicalBlock: input.blockRange.first,
    lastLogicalBlock,
    blockSize: input.blockSize ?? input.blockRange.size,
    blockCount: input.blockRange.size,
    generatorVersion: input.generatorVersion,
    wheelVersion: input.wheelVersion,
    publishedAt: new Date().toISOString(),
  };

  if (input.products) {
    entry.products = {
      strategyVersion: input.products.strategyVersion,
      taskContractVersion: input.products.taskContractVersion,
      validatorVersion: input.products.validatorVersion,
      sourcePackageId: input.packageId,
      sourceJobId: input.products.sourceJobId,
      sourceBlockIndex: input.products.sourceBlockIndex,
      sourcePrimeHash: input.products.sourcePrimeHash,
    };
  }

  return entry;
}

export async function loadIndex(
  storage: ArtifactStorage,
  phase: PhaseType
): Promise<PublishIndex> {
  let content: unknown;
  try {
    content = await storage.load(indexReference(phase));
  } catch {
    // No existe todavía: índice vacío, no es un error.
    return emptyIndex(phase);
  }

  if (
    !content ||
    typeof content !== "object" ||
    !Array.isArray((content as PublishIndex).packages)
  ) {
    throw new PublishIndexError(
      "INDEX_INVALID",
      `The publish index for phase ${phase} has an invalid structure.`
    );
  }
  return content as PublishIndex;
}

export async function persistIndex(
  storage: ArtifactStorage,
  phase: PhaseType,
  index: PublishIndex
): Promise<void> {
  await storage.saveAt(indexReference(phase), index, {
    type: `publish-index-${phase.toLowerCase()}`,
    version: "1.0.0",
  });
}

export async function persistArchive(
  storage: ArtifactStorage,
  phase: PhaseType,
  entry: PublishIndexEntry,
  archive: Uint8Array
): Promise<void> {
  await storage.saveAt(archiveReference(phase, entry), archive, {
    type: `publish-archive-${phase.toLowerCase()}`,
    version: "1.0.0",
  });
}

export async function persistWrites(
  storage: ArtifactStorage,
  writes: readonly ArtifactWrite[],
  message: string
): Promise<void> {
  const paths = new Set<string>();
  for (const { reference } of writes) {
    if (paths.has(reference.path)) {
      throw new PublishIndexError(
        "DUPLICATE_ARTIFACT_PATH",
        `A publication batch cannot write the same path more than once: ${reference.path}.`
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

export async function loadArchive(
  storage: ArtifactStorage,
  phase: PhaseType,
  entry: PublishIndexEntry
): Promise<Uint8Array | null> {
  try {
    const content = await storage.load(archiveReference(phase, entry));
    if (!isUint8Array(content)) return null;
    return content;
  } catch {
    return null;
  }
}

export function verifyArchive(
  entry: PublishIndexEntry,
  archive: Uint8Array
): void {
  const sha256 = createHash("sha256").update(archive).digest("hex");
  if (archive.byteLength !== entry.sizeBytes || sha256 !== entry.sha256) {
    throw new PublishIndexError(
      "ARCHIVE_INTEGRITY_ERROR",
      `Published archive ${entry.filename} failed integrity check (size or sha256 mismatch).`
    );
  }
}

/**
 * Comprueba si la referencia física del archive ya existe en el storage,
 * sin cargar su contenido completo cuando el backend lo permite.
 */
export async function archiveExists(
  storage: ArtifactStorage,
  phase: PhaseType,
  entry: PublishIndexEntry
): Promise<boolean> {
  try {
    await storage.getMetadata(archiveReference(phase, entry));
    return true;
  } catch {
    return false;
  }
}
