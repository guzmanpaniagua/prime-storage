import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ArtifactMetadata,
  ArtifactReference,
  ArtifactStorage,
} from "../contracts/artifact-storage.js";
import type { ArtifactContent } from "../models/artifact-content.js";
import {
  decodeBinaryContent,
  deserializePersistedDocument,
  encodeBinaryContent,
  isUint8Array,
  serializePersistedDocument,
  type PersistedArtifactDocument,
  type PersistedContentType,
} from "../models/persisted-artifact-document.js";

export class LocalArtifactStorage implements ArtifactStorage {
  private readonly storageDir: string;

  constructor(storageDir = ".storage") {
    this.storageDir = storageDir;
  }

  async save(
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference> {
    const id = randomUUID();
    const path = `${id}.json`;

    const isBinary = isUint8Array(data);
    const contentType: PersistedContentType = isBinary ? "binary" : "json";
    const persistedData = isBinary ? encodeBinaryContent(data) : data;

    const document: PersistedArtifactDocument = {
      reference: { id, path },
      metadata,
      contentType,
      data: persistedData,
    };

    await mkdir(this.storageDir, { recursive: true });
    await writeFile(join(this.storageDir, path), serializePersistedDocument(document));

    return { id, path };
  }

  async saveAt(
    reference: ArtifactReference,
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference> {
    const isBinary = isUint8Array(data);
    const contentType: PersistedContentType = isBinary ? "binary" : "json";
    const persistedData = isBinary ? encodeBinaryContent(data) : data;

    const path = join(this.storageDir, reference.path);
    const document: PersistedArtifactDocument = {
      reference: { id: reference.id, path },
      metadata,
      contentType,
      data: persistedData,
    };

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializePersistedDocument(document));

    return { id: reference.id, path };
  }

  async load(reference: ArtifactReference): Promise<unknown> {
    const raw = await readFile(this.resolvePath(reference), "utf-8");
    const stored = deserializePersistedDocument(raw);

    if (stored.contentType === "binary") {
      return decodeBinaryContent(stored.data);
    }
    return stored.data;
  }

  async getMetadata(reference: ArtifactReference): Promise<ArtifactMetadata> {
    const raw = await readFile(this.resolvePath(reference), "utf-8");
    const stored = deserializePersistedDocument(raw);
    return stored.metadata;
  }

  private resolvePath(reference: ArtifactReference): string {
    if (isAbsolute(reference.path)) return reference.path;
    return join(this.storageDir, reference.path);
  }
}
