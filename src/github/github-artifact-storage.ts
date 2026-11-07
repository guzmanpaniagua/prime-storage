import { randomUUID } from "node:crypto";
import type {
  ArtifactContent,
  ArtifactMetadata,
  ArtifactReference,
  ArtifactWrite,
  ArtifactStorage,
} from "../contracts/artifact-storage.js";
import type { ArtifactDocument } from "../models/artifact-document.js";
import {
  decodeBinaryContent,
  deserializePersistedDocument,
  encodeBinaryContent,
  isUint8Array,
  serializePersistedDocument,
  type PersistedArtifactDocument,
  type PersistedContentType,
} from "../models/persisted-artifact-document.js";
import { GithubClient } from "./github-client.js";
import { GithubStorageError } from "./github-errors.js";
import type { GithubFile } from "./github-file.js";
import type { GithubStorageConfig } from "./github-storage-config.js";

export class GithubArtifactStorage implements ArtifactStorage {
  private readonly client: GithubClient;

  constructor(
    config: GithubStorageConfig,
    fetchImpl: typeof fetch = fetch
  ) {
    this.client = new GithubClient(config, fetchImpl);
  }

  async save(
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference> {
    const id = randomUUID();
    const path = `artifacts/${id}.json`;

    const isBinary = isUint8Array(data);
    const contentType: PersistedContentType = isBinary ? "binary" : "json";
    const persistedData = isBinary ? encodeBinaryContent(data) : data;

    const reference: ArtifactReference = { id, path };
    const document: PersistedArtifactDocument = {
      reference,
      metadata,
      contentType,
      data: persistedData,
    };

    const file: GithubFile = {
      path,
      base64: Buffer.from(serializePersistedDocument(document)).toString("base64"),
    };

    await this.client.commitFiles([file], `Save artifact ${id}`);
    return reference;
  }

  async saveAt(
    reference: ArtifactReference,
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference> {
    const isBinary = isUint8Array(data);
    const contentType: PersistedContentType = isBinary ? "binary" : "json";
    const persistedData = isBinary ? encodeBinaryContent(data) : data;

    const document: PersistedArtifactDocument = {
      reference,
      metadata,
      contentType,
      data: persistedData,
    };

    const file: GithubFile = {
      path: reference.path,
      base64: Buffer.from(serializePersistedDocument(document)).toString("base64"),
    };

    await this.client.commitFiles([file], `Save artifact at ${reference.path}`);
    return reference;
  }

  async saveManyAt(
    writes: readonly ArtifactWrite[],
    message = "Save artifacts"
  ): Promise<ArtifactReference[]> {
    const paths = new Set<string>();
    const files = writes.map(({ reference, data, metadata }) => {
      if (paths.has(reference.path)) {
        throw new GithubStorageError(
          400,
          "GITHUB_BATCH_DUPLICATE_PATH",
          `A batch cannot write the same path more than once: ${reference.path}.`
        );
      }
      paths.add(reference.path);
      return {
        path: reference.path,
        base64: Buffer.from(this.serializeWrite(reference, data, metadata)).toString("base64"),
      };
    });
    if (files.length === 0) return [];

    await this.client.commitFiles(files, message);
    return writes.map(({ reference }) => reference);
  }

  async load(reference: ArtifactReference): Promise<ArtifactContent> {
    const document = await this.readAndValidateArtifact(reference);
    if (document.contentType === "binary") {
      return decodeBinaryContent(document.data);
    }
    return document.data;
  }

  async getMetadata(
    reference: ArtifactReference
  ): Promise<ArtifactMetadata> {
    const document = await this.readAndValidateArtifact(reference);
    return document.metadata;
  }

  async verifyBranch(): Promise<void> {
    await this.client.verifyBranch();
  }

  async listDirectory(path: string): Promise<Array<{ name: string; type: string }>> {
    return this.client.listDirectory(path);
  }

  private async readAndValidateArtifact(
    reference: ArtifactReference
  ): Promise<PersistedArtifactDocument> {
    const content = await this.client.readFile(reference.path);
    if (content === null) {
      throw new GithubStorageError(
        404,
        "GITHUB_ARTIFACT_NOT_FOUND",
        `The artifact was not found at path ${reference.path}.`
      );
    }

    try {
      return deserializePersistedDocument(content);
    } catch {
      throw new GithubStorageError(
        502,
        "GITHUB_ARTIFACT_UNEXPECTED_STRUCTURE",
        `The artifact at path ${reference.path} is not a valid persisted artifact document.`
      );
    }
  }

  private serializeWrite(
    reference: ArtifactReference,
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): string {
    const isBinary = isUint8Array(data);
    const contentType: PersistedContentType = isBinary ? "binary" : "json";
    const persistedData = isBinary ? encodeBinaryContent(data) : data;
    const document: PersistedArtifactDocument = {
      reference,
      metadata,
      contentType,
      data: persistedData,
    };
    return serializePersistedDocument(document);
  }
}
