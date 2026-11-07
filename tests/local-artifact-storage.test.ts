import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  FflateZipService,
  LocalArtifactStorage,
} from "../src/index.js";

describe("LocalArtifactStorage", () => {
  it("saves and loads an object with deep equality", async () => {
    const storage = new LocalArtifactStorage();
    const data = { hello: "world", value: 123 };

    const reference = await storage.save(data, {
      type: "test",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);

    expect(loaded).toEqual(data);
  });

  it("saves and loads a Uint8Array byte by byte", async () => {
    const storage = new LocalArtifactStorage();
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    const reference = await storage.save(data, {
      type: "binary-test",
      version: "1.0.0",
    });
    const result = await storage.load(reference);

    expect(result instanceof Uint8Array).toBe(true);
    expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
  });

  it("recovers metadata after saving", async () => {
    const storage = new LocalArtifactStorage();
    const metadata = { type: "prime", version: "2.0.0" };

    const reference = await storage.save({ hello: "world" }, metadata);
    const recovered = await storage.getMetadata(reference);

    expect(recovered).toEqual(metadata);
  });

  it("round-trips a ZIP produced by ZipService", async () => {
    const storage = new LocalArtifactStorage();
    const zipService = new FflateZipService();
    const payload = { primes: [2, 3, 5, 7, 11], label: "package-50" };
    const zip = zipService.compressJson(payload);

    const reference = await storage.save(zip, {
      type: "primes-package",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);

    expect(loaded instanceof Uint8Array).toBe(true);
    const decompressed = zipService.decompressJson<Record<string, unknown>>(
      loaded as Uint8Array
    );
    expect(decompressed).toEqual(payload);
  });

  it("saveAt returns a stable logical reference that can be loaded again", async () => {
    const root = await mkdtemp(join(tmpdir(), "local-artifact-reference-"));
    const storage = new LocalArtifactStorage(root);
    const reference = { id: "nested-artifact", path: "campaigns/demo/state/latest.json" };

    try {
      await expect(storage.saveAt(reference, { sequence: 3 }, { type: "state", version: "1" }))
        .resolves.toEqual(reference);
      await expect(storage.load(reference)).resolves.toEqual({ sequence: 3 });
      await expect(storage.getMetadata(reference)).resolves.toEqual({ type: "state", version: "1" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("round-trips saveAt references when storageDir is relative", async () => {
    const root = `.storage-test-${randomUUID()}`;
    const storage = new LocalArtifactStorage(root);
    const reference = { id: "relative-root", path: "campaigns/demo/latest.json" };

    try {
      await storage.saveAt(reference, { sequence: 4 }, { type: "state", version: "1" });
      await expect(storage.load(reference)).resolves.toEqual({ sequence: 4 });
    } finally {
      await rm(resolve(root), { recursive: true, force: true });
    }
  });

  it.each([
    "/tmp/outside-artifact.json",
    "../outside-artifact.json",
    "nested/../../outside-artifact.json",
  ])("rejects unsafe reference paths (%s)", async (path) => {
    const root = await mkdtemp(join(tmpdir(), "local-artifact-path-"));
    const storage = new LocalArtifactStorage(root);

    try {
      await expect(storage.saveAt({ id: "unsafe", path }, {}, { type: "test", version: "1" }))
        .rejects.toThrow(/inside the storage root|relative path/);
      await expect(storage.load({ id: "unsafe", path }))
        .rejects.toThrow(/inside the storage root|relative path/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a path whose parent symlink resolves outside the storage root", async () => {
    const base = await mkdtemp(join(tmpdir(), "local-artifact-symlink-"));
    const root = join(base, "storage");
    const outside = join(base, "outside");
    const storage = new LocalArtifactStorage(root);
    const reference = { id: randomUUID(), path: "linked/outside.json" };
    const { mkdir } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });
    await symlink(outside, join(root, "linked"), "dir");

    try {
      await expect(storage.saveAt(reference, {}, { type: "test", version: "1" }))
        .rejects.toThrow(/symbolic link/);
      await expect(stat(outside)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects a destination symlink even when its parent is inside the root", async () => {
    const base = await mkdtemp(join(tmpdir(), "local-artifact-file-symlink-"));
    const root = join(base, "storage");
    const outsideFile = join(base, "outside.json");
    const storage = new LocalArtifactStorage(root);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });
    await writeFile(outsideFile, "unchanged");
    await symlink(outsideFile, join(root, "linked.json"));

    try {
      await expect(storage.saveAt(
        { id: "linked", path: "linked.json" },
        { overwritten: true },
        { type: "test", version: "1" }
      )).rejects.toThrow(/symbolic link/);
    } finally {
        expect(await readFile(outsideFile, "utf8")).toBe("unchanged");
      await rm(base, { recursive: true, force: true });
    }
  });
});
