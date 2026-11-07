import type { ArtifactWrite } from "../../contracts/artifact-storage.js";

export type PhaseType =
  | "PRIMES"
  | "PRODUCTS"
  | "ANCHORS"
  | "ANCHOR_SIEVE"
  | "FACTORS"
  | "SMALL_CERTIFICATES"
  | "SUCCESSIVE_SIEVES"
  | "FINAL_CERTIFICATION";

export interface PublishIndex {
  phase: PhaseType;
  packages: PublishIndexEntry[];
}

export interface PublishIndexEntry {
  packageId: number;
  filename: string;
  sha256: string;
  sizeBytes: number;
  firstLogicalBlock: number;
  lastLogicalBlock: number;
  blockSize: number;
  blockCount: number;
  generatorVersion: string;
  wheelVersion: string;
  publishedAt: string;
  products?: {
    strategyVersion: string;
    taskContractVersion: string;
    validatorVersion: string;
    sourcePackageId: number;
    sourceJobId: string;
    /** Legacy fields kept so no information from the previous model is lost. */
    sourceBlockIndex?: number;
    sourcePrimeHash?: string;
  };
}

export interface PublishPackageInput {
  phase: PhaseType;
  packageId: number;
  archive: Uint8Array;
  blockRange: { first: number; size: number };
  /** Optional explicit block size; independent of blockCount. */
  blockSize?: number;
  generatorVersion: string;
  wheelVersion: string;
  /** Optional publication timestamp supplied by callers that snapshot the resulting index. */
  publishedAt?: string;
  products?: {
    strategyVersion: string;
    taskContractVersion: string;
    validatorVersion: string;
    sourceJobId: string;
    /** Legacy fields kept so no information from the previous model is lost. */
    sourceBlockIndex?: number;
    sourcePrimeHash?: string;
  };
  /** Extra artifacts to include in the same publication operation (e.g. checkpoint state). */
  additionalArtifacts?: ArtifactWrite[];
}

export interface PublishPackageResult {
  status: "registered" | "already-published";
  entry: PublishIndexEntry;
  index: PublishIndex;
}
