import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LocalArtifactStorage,
  LocalProjectStateStore,
} from "../src/index.js";
import type { ProjectState } from "../src/index.js";

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "project-state-test-"));
  return new LocalProjectStateStore(new LocalArtifactStorage(dir));
}

describe("LocalProjectStateStore", () => {
  it("returns null when the project state does not exist", async () => {
    const store = await createStore();

    const state = await store.getProjectState();

    expect(state).toBeNull();
  });

  it("propagates a read error instead of treating it as missing state", async () => {
    const storage = {
      load: async () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); },
    };
    const store = new LocalProjectStateStore(storage as unknown as import("../src/index.js").ArtifactStorage);

    await expect(store.getProjectState()).rejects.toMatchObject({ code: "EACCES" });
  });

  it("returns a valid document after saving it", async () => {
    const store = await createStore();
    const state: ProjectState = {
      phases: [{ id: "PRIMES", status: "completed" }],
      audit: [{ at: "2026-01-01T00:00:00Z", action: "phase-completed" }],
    };

    await store.saveProjectState(state);
    const loaded = await store.getProjectState();

    expect(loaded).toEqual(state);
  });

  it("throws PHASES_INVALID for a corrupted document", async () => {
    const store = await createStore();
    await store.saveProjectState({
      phases: ["not-an-object"],
      audit: [],
    } as unknown as ProjectState);

    // Corromper el documento escribiendo una estructura inválida directamente.
    const storage = new LocalArtifactStorage(
      join(tmpdir(), "project-state-test-invalid")
    );
    await storage.saveAt({ id: "project-state", path: "project-phases.json" }, { phases: "no-array" }, {
      type: "project-state",
      version: "1.0.0",
    });
    const corruptedStore = new LocalProjectStateStore(storage);

    await expect(corruptedStore.getProjectState()).rejects.toMatchObject({
      name: "ProjectStateError",
      code: "PHASES_INVALID",
    });
  });

  it("overwrites the previous state on save", async () => {
    const store = await createStore();
    await store.saveProjectState({ phases: [{ id: 1 }], audit: [] });
    await store.saveProjectState({ phases: [{ id: 2 }], audit: [{ ok: true }] });

    const loaded = await store.getProjectState();

    expect(loaded).toEqual({ phases: [{ id: 2 }], audit: [{ ok: true }] });
  });
});
