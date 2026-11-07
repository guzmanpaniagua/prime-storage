import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ArtifactMetadata,
  ArtifactReference,
  ArtifactWrite,
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
    this.storageDir = resolve(storageDir);
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

    const path = this.resolvePath(reference);
    await mkdir(this.storageDir, { recursive: true });
    await this.assertNoSymlinkParents(path);
    await mkdir(dirname(path), { recursive: true });
    await this.assertInsideStorageRoot(path);
    const document: PersistedArtifactDocument = {
      reference: { id: reference.id, path: reference.path },
      metadata,
      contentType,
      data: persistedData,
    };

    await writeFile(path, serializePersistedDocument(document));

    return { id: reference.id, path: reference.path };
  }

  async saveManyAt(writes: readonly ArtifactWrite[]): Promise<ArtifactReference[]> {
    const saved: ArtifactReference[] = [];
    for (const write of writes) {
      saved.push(await this.saveAt(write.reference, write.data, write.metadata));
    }
    return saved;
  }

  async load(reference: ArtifactReference): Promise<unknown> {
    const path = this.resolvePath(reference);
    await this.assertInsideStorageRoot(path);
    const raw = await readFile(path, "utf-8");
    const stored = deserializePersistedDocument(raw);

    if (stored.contentType === "binary") {
      return decodeBinaryContent(stored.data);
    }
    return stored.data;
  }

  async getMetadata(reference: ArtifactReference): Promise<ArtifactMetadata> {
    const path = this.resolvePath(reference);
    await this.assertInsideStorageRoot(path);
    const raw = await readFile(path, "utf-8");
    const stored = deserializePersistedDocument(raw);
    return stored.metadata;
  }

  private resolvePath(reference: ArtifactReference): string {
    if (
      !reference.path
      || isAbsolute(reference.path)
      || reference.path.includes("\\")
      || reference.path.split("/").some((part) => part === ".." || part === "." || part === "")
    ) {
      throw new Error("Artifact path must be a non-empty relative path inside the storage root.");
    }
    const path = resolve(this.storageDir, reference.path);
    const pathFromRoot = relative(this.storageDir, path);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error("Artifact path must stay inside the storage root.");
    }
    return path;
  }

  private async assertInsideStorageRoot(path: string): Promise<void> {
    const root = await realpath(this.storageDir);
    try {
      const target = await lstat(path);
      if (target.isSymbolicLink()) {
        throw new Error("Artifact path cannot be a symbolic link.");
      }
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error)
        || (error as { code?: unknown }).code !== "ENOENT") {
        throw error;
      }
    }
    const resolvedPath = await realpath(dirname(path));
    const relativePath = relative(root, resolvedPath);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      throw new Error("Artifact path resolves outside the storage root.");
    }
  }

  private async assertNoSymlinkParents(path: string): Promise<void> {
    let current = dirname(path);
    while (current !== this.storageDir) {
      try {
        const parent = await lstat(current);
        if (parent.isSymbolicLink()) {
          throw new Error("Artifact parent path cannot contain a symbolic link.");
        }
      } catch (error) {
        if (typeof error !== "object" || error === null || !("code" in error)
          || (error as { code?: unknown }).code !== "ENOENT") {
          throw error;
        }
      }
      const next = dirname(current);
      if (next === current) break;
      current = next;
    }
  }
}
