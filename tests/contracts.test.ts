import { describe, expect, it } from "vitest";
import type {
  ArtifactMetadata,
  ArtifactReference,
  ArtifactStorage,
} from "../src/index.js";

describe("contracts", () => {
  it("exports compile and are assignable", () => {
    const metadata: ArtifactMetadata = { type: "prime", version: "1.0.0" };
    const reference: ArtifactReference = { id: "abc", path: "store/abc" };

    const storage: Pick<ArtifactStorage, "save" | "load"> = {
      save: async () => reference,
      load: async () => metadata,
    };

    expect(metadata.type).toBe("prime");
    expect(reference.id).toBe("abc");
    expect(storage).toBeDefined();
  });
});
