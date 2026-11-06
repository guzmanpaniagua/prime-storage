import type { ArtifactContent } from "./artifact-content.js";
import type {
  ArtifactMetadata,
  ArtifactReference,
} from "./artifact.js";
import type { ArtifactDocument } from "./artifact-document.js";

export type PersistedContentType = "json" | "binary";

/**
 * Format persisted by every ArtifactStorage implementation.
 * `contentType` distinguishes plain JSON documents from binary payloads
 * (stored as base64 in `data`).
 */
export interface PersistedArtifactDocument extends ArtifactDocument {
  contentType: PersistedContentType;
}

export function isUint8Array(value: ArtifactContent): value is Uint8Array {
  return value instanceof Uint8Array;
}

export function serializePersistedDocument(
  document: PersistedArtifactDocument
): string {
  return JSON.stringify(document, null, 2);
}

export function deserializePersistedDocument(
  raw: string
): PersistedArtifactDocument {
  const parsed = JSON.parse(raw) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Persisted artifact document has an unexpected structure.");
  }

  const document = parsed as {
    reference?: unknown;
    metadata?: unknown;
    contentType?: unknown;
    data?: unknown;
  };

  if (
    typeof document.reference !== "object" ||
    document.reference === null ||
    typeof document.metadata !== "object" ||
    document.metadata === null ||
    (document.contentType !== "json" && document.contentType !== "binary") ||
    !("data" in document)
  ) {
    throw new Error(
      "Persisted artifact document is missing reference, metadata, contentType or data."
    );
  }

  const metadata = document.metadata as {
    type?: unknown;
    version?: unknown;
  };
  if (
    typeof metadata.type !== "string" ||
    typeof metadata.version !== "string"
  ) {
    throw new Error("Persisted artifact document has no valid metadata.");
  }

  return {
    reference: document.reference as ArtifactReference,
    metadata: metadata as ArtifactMetadata,
    contentType: document.contentType,
    data: document.data as ArtifactContent,
  };
}

export function decodeBinaryContent(data: ArtifactContent): Uint8Array {
  return new Uint8Array(Buffer.from(data as string, "base64"));
}

export function encodeBinaryContent(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}
