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
    sourcePackageId: number;
    sourceJobId: string;
    sourceBlockIndex: number;
    sourcePrimeHash: string;
  };
}

export interface PublishPackageInput {
  phase: PhaseType;
  packageId: number;
  archive: Uint8Array;
  blockRange: { first: number; size: number };
  generatorVersion: string;
  wheelVersion: string;
  products?: {
    sourceJobId: string;
    sourceBlockIndex: number;
    sourcePrimeHash: string;
  };
}

export interface PublishPackageResult {
  status: "registered" | "already-published";
  entry: PublishIndexEntry;
  index: PublishIndex;
}
