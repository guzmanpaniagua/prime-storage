import { describe, expect, it } from "vitest";
import type {
  CampaignArtifactKind,
  CampaignArtifactReference,
  CampaignCheckpointPointer,
  CampaignCheckpointSnapshot,
} from "../src/index.js";
import type { PublishIndex } from "../src/index.js";

const packageIndex: PublishIndex = {
  phase: "PRIMES",
  packages: [
    {
      packageId: 1,
      filename: "primes-000001.zip",
      sha256: "a".repeat(64),
      sizeBytes: 128,
      itemCount: 10,
      publishedAt: "2026-11-06T00:00:00.000Z",
      version: "1.0.0",
    },
  ],
};

const artifact: CampaignArtifactReference = {
  kind: "RECOVERY_RESULTS_ARCHIVE",
  path: "campaigns/camp-1/recovery/bundle.zip",
  sha256: "b".repeat(64),
  sizeBytes: 256,
};

const pointer: CampaignCheckpointPointer = {
  schemaVersion: "1.0.0",
  campaignId: "camp-1",
  sequence: 1,
  snapshotPath: "campaigns/camp-1/state/snapshots/checkpoint-000001.json",
  snapshotSha256: "c".repeat(64),
  lastPublishedPackageId: 1,
  lastPublishedLogicalBlock: 10,
  nextLogicalBlockToPublish: 11,
  jobId: "job-1",
  jobType: "PRIME_SEARCH",
};

const snapshot: CampaignCheckpointSnapshot = {
  schemaVersion: "1.0.0",
  kind: "campaign-checkpoint",
  campaignId: "camp-1",
  sequence: 1,
  createdAt: "2026-11-06T00:00:00.000Z",
  phase: "PRIMES",
  jobId: "job-1",
  jobType: "PRIME_SEARCH",
  lastPublishedPackageId: 1,
  lastPublishedLogicalBlock: 10,
  nextLogicalBlockToPublish: 11,
  highestVerifiedResultBlock: 12,
  jobState: { blocks: [1, 2, 3] },
  packageIndex,
  artifact,
  unpublishedResultBlocks: [12],
};

describe("campaign-checkpoint-types", () => {
  it("el puntero respeta la estructura persistida en state/latest.json", () => {
    expect(pointer.schemaVersion).toBe("1.0.0");
    expect(pointer.snapshotPath).toBe(
      "campaigns/camp-1/state/snapshots/checkpoint-000001.json"
    );
    expect(pointer.snapshotSha256).toHaveLength(64);
    expect(pointer.jobType).toBe("PRIME_SEARCH");
  });

  it("el snapshot respeta la estructura persistida en state/snapshots/", () => {
    expect(snapshot.kind).toBe("campaign-checkpoint");
    expect(snapshot.packageIndex.packages[0]?.packageId).toBe(1);
    expect(snapshot.artifact.kind).toBe("RECOVERY_RESULTS_ARCHIVE");
    expect(snapshot.unpublishedResultBlocks).toEqual([12]);
    expect(snapshot.highestVerifiedResultBlock).toBe(12);
  });

  it("los cursores del snapshot coinciden con los del puntero", () => {
    expect(snapshot.lastPublishedPackageId).toBe(pointer.lastPublishedPackageId);
    expect(snapshot.lastPublishedLogicalBlock).toBe(pointer.lastPublishedLogicalBlock);
    expect(snapshot.nextLogicalBlockToPublish).toBe(pointer.nextLogicalBlockToPublish);
  });

  it("CampaignArtifactKind solo admite los dos tipos definidos", () => {
    const kinds: CampaignArtifactKind[] = ["RECOVERY_RESULTS_ARCHIVE", "PUBLISHED_PACKAGE"];
    expect(kinds).toHaveLength(2);
    const published: CampaignArtifactReference = {
      kind: "PUBLISHED_PACKAGE",
      path: "primes/primes-000001.zip",
      sha256: "c".repeat(64),
      sizeBytes: 128,
      packageId: 1,
    };
    expect(published.packageId).toBe(1);
  });
});
