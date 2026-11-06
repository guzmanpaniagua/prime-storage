import type { JobType } from './domainTypes.js';
import type { PublishIndex, PhaseType } from './packageTypes.js';

export interface CheckpointArtifactReference {
  kind: 'RECOVERY_RESULTS_ARCHIVE' | 'PUBLISHED_PACKAGE';
  path: string;
  sha256: string;
  sizeBytes: number;
  packageId?: number;
}

export interface CampaignCheckpointSnapshot {
  schemaVersion: '1.0.0';
  kind: 'campaign-checkpoint';
  campaignId: string;
  sequence: number;
  createdAt: string;
  phase: PhaseType;
  jobId: string;
  jobType: JobType;
  lastPublishedPackageId: number;
  lastPublishedLogicalBlock: number;
  nextLogicalBlockToPublish: number;
  highestVerifiedResultBlock: number;
  jobState: Record<string, unknown>;
  packageIndex: PublishIndex;
  artifact: CheckpointArtifactReference;
  unpublishedResultBlocks: number[];
}

export interface CampaignCheckpointPointer {
  schemaVersion: '1.0.0';
  campaignId: string;
  sequence: number;
  snapshotPath: string;
  snapshotSha256: string;
  lastPublishedPackageId: number;
  lastPublishedLogicalBlock: number;
  nextLogicalBlockToPublish: number;
  jobId: string;
  jobType: JobType;
}

export interface GitHubCheckpointFile {
  path: string;
  content: string | Uint8Array;
}
