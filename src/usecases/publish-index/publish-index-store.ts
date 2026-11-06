import type {
  PhaseType,
  PublishIndexEntry,
  PublishPackageInput,
  PublishPackageResult,
} from "./publish-index-types.js";

export interface PublishIndexStore {
  getPublishedPackages(
    phase: PhaseType
  ): Promise<readonly PublishIndexEntry[]>;

  getPublishedPackage(
    phase: PhaseType,
    packageId: number
  ): Promise<PublishIndexEntry | null>;

  getPublishedArchive(
    phase: PhaseType,
    packageId: number
  ): Promise<Uint8Array | null>;

  registerPublishedPackage(
    input: PublishPackageInput
  ): Promise<PublishPackageResult>;

  /**
   * Carga el archive publicado y verifica su sha256 y sizeBytes contra
   * su entrada del índice. Lanza ARCHIVE_INTEGRITY_ERROR si no coinciden,
   * PACKAGE_NOT_FOUND si el paquete no está en el índice y
   * PACKAGE_ARCHIVE_MISSING si el archive físico no existe.
   */
  verifyPublishedArchive(
    phase: PhaseType,
    packageId: number
  ): Promise<void>;
}
