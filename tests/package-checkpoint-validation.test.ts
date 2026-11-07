import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CampaignCheckpointError, validatePackageCheckpointArtifacts } from "../src/index.js";
import type { CampaignCheckpointPointer, CampaignCheckpointSnapshot, PackageCheckpointFile, PublishIndexEntry } from "../src/index.js";

const archive = new Uint8Array([1, 2, 3]);
const archiveHash = createHash("sha256").update(archive).digest("hex");
const entry: PublishIndexEntry = {
  packageId: 1,
  filename: "primes-pack-000001.zip",
  sha256: archiveHash,
  sizeBytes: archive.byteLength,
  firstLogicalBlock: 0,
  lastLogicalBlock: 299,
  blockSize: 300,
  blockCount: 1,
  generatorVersion: "1.0.0",
  wheelVersion: "1.0.0",
  publishedAt: "2026-11-07T00:00:00.000Z",
};

function files(overrides: {
  pointer?: Partial<CampaignCheckpointPointer>;
  snapshot?: Partial<CampaignCheckpointSnapshot>;
} = {}): PackageCheckpointFile[] {
  const campaignId = "campaign-1";
  const snapshot: CampaignCheckpointSnapshot = {
    schemaVersion: "1.0.0",
    kind: "campaign-checkpoint",
    campaignId,
    sequence: 1,
    createdAt: "2026-11-07T00:00:00.000Z",
    phase: "PRIMES",
    jobId: "job-1",
    jobType: "PRIME_SEARCH",
    lastPublishedPackageId: 1,
    lastPublishedLogicalBlock: 299,
    nextLogicalBlockToPublish: 300,
    highestVerifiedResultBlock: 299,
    jobState: { jobId: "job-1" },
    packageIndex: { phase: "PRIMES", packages: [entry] },
    artifact: {
      kind: "PUBLISHED_PACKAGE",
      packageId: 1,
      path: "primes/primes-pack-000001.zip",
      sha256: archiveHash,
      sizeBytes: archive.byteLength,
    },
    unpublishedResultBlocks: [],
    ...overrides.snapshot,
  };
  const snapshotText = JSON.stringify(snapshot, null, 2);
  const pointer: CampaignCheckpointPointer = {
    schemaVersion: "1.0.0",
    campaignId,
    sequence: 1,
    snapshotPath: `campaigns/${campaignId}/state/snapshots/checkpoint-000001.json`,
    snapshotSha256: createHash("sha256").update(snapshotText).digest("hex"),
    lastPublishedPackageId: 1,
    lastPublishedLogicalBlock: 299,
    nextLogicalBlockToPublish: 300,
    jobId: "job-1",
    jobType: "PRIME_SEARCH",
    ...overrides.pointer,
  };
  return [
    { path: `campaigns/${campaignId}/state/latest.json`, content: JSON.stringify(pointer) },
    { path: pointer.snapshotPath, content: snapshotText },
  ];
}

describe("validatePackageCheckpointArtifacts", () => {
  it("accepts a pointer and snapshot that reference the package being published", () => {
    const result = validatePackageCheckpointArtifacts({ phase: "PRIMES", entry, files: files() });

    expect(result.pointer.sequence).toBe(entry.packageId);
    expect(result.snapshot.artifact.sha256).toBe(entry.sha256);
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts.find((artifact) => artifact.reference.path.endsWith("/state/latest.json"))?.data)
      .toMatchObject({ sequence: entry.packageId });
    expect(result.artifacts.find((artifact) => artifact.reference.path.endsWith("checkpoint-000001.json"))?.data)
      .toBeTypeOf("string");
  });

  it.each([
    ["snapshot hash", { pointer: { snapshotSha256: "f".repeat(64) } }],
    ["package cursor", { snapshot: { nextLogicalBlockToPublish: 301 } }],
    ["artifact reference", { snapshot: { artifact: { kind: "PUBLISHED_PACKAGE", packageId: 1, path: "primes/other.zip", sha256: archiveHash, sizeBytes: archive.byteLength } } }],
    ["package index", { snapshot: { packageIndex: { phase: "PRIMES", packages: [] } } }],
  ] as const)("rejects a mismatched %s", (_name, overrides) => {
    expect(() => validatePackageCheckpointArtifacts({ phase: "PRIMES", entry, files: files(overrides) }))
      .toThrowError(CampaignCheckpointError);
  });

  it("rejects malformed or incomplete checkpoint files", () => {
    expect(() => validatePackageCheckpointArtifacts({
      phase: "PRIMES",
      entry,
      files: [{ path: "campaigns/campaign-1/state/latest.json", content: "{}" }],
    })).toThrowError(CampaignCheckpointError);
  });
});
