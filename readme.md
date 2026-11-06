# prime-storage

Storage and publication layer for the distributed prime generation platform.

`prime-storage` owns everything related to persistence:

- Artifact storage (local filesystem or GitHub-backed)
- Binary artifacts and ZIP archives
- Publication indexes with integrity verification (sha256 + size)
- Metadata management

It does **not** contain:

- Prime generation algorithms
- Factorization logic
- Workers
- Task distribution
- Admin workflows
- Mathematical validation

Those responsibilities belong to other repositories.

---

## Installation

The package is consumed directly from GitHub (not published to npm yet):

```bash
npm install github:guzmanpaniagua/prime-storage#v1.1.0
```

Or in your `package.json`:

```json
"dependencies": {
  "prime-storage": "github:guzmanpaniagua/prime-storage#v1.1.0"
}
```

You can also point to a branch (`#main`) or a commit SHA. The `prepare` script
builds the package automatically on install, so the compiled entry
(`dist/index.js`) is always available in the destination `node_modules`.

> **Note:** the README travels with the repo but is not needed at runtime —
> npm only copies package files into `node_modules`; consumers never need it.

---

## Architecture

The platform is split into independent domains:

```text
prime-math
    ↓
    Mathematical algorithms

distributed-data-generator
    ↓
    Work distribution and orchestration

prime-storage
    ↓
    Persistence and publication
```

---

## Usage

### Local artifact storage

```ts
import { LocalArtifactStorage } from "prime-storage";

const storage = new LocalArtifactStorage("./.storage");

const reference = await storage.save(
  { hello: "world" },
  { type: "example", version: "1.0.0" }
);

const data = await storage.load(reference);
const metadata = await storage.getMetadata(reference);
```

### GitHub artifact storage

```ts
import { GithubArtifactStorage } from "prime-storage";

const storage = new GithubArtifactStorage({
  owner: "guzmanpaniagua",
  repository: "prime-storage",
  branch: "main",
  token: process.env.GITHUB_TOKEN!, // repo contents: read & write
});
```

Both implementations satisfy the same `ArtifactStorage` contract:

| Method | Description |
| --- | --- |
| `save(data, metadata)` | Persists content, returns an `ArtifactReference` (`id`, `path`). |
| `saveAt(reference, data, metadata)` | Persists content at an explicit reference. |
| `load(reference)` | Reads the stored content (JSON or `Uint8Array`). |
| `getMetadata(reference)` | Reads the artifact metadata (`type`, `version`). |

### ZIP archives

```ts
import { FflateZipService } from "prime-storage";

const zip = new FflateZipService();
const archive = zip.compressJson(data);          // Uint8Array (data.json inside)
const data = zip.decompressJson<MyType>(archive);
```

### Publication index

The publish-index use case registers published packages per phase and keeps a
JSON index (`publish-index/<PHASE>.json`) alongside the archives, verifying
sha256 and size on read.

```ts
import {
  GithubArtifactStorage,
  GithubPublishIndexStore,
  phaseIndexFromStore,
  publishedPackageFromStore,
} from "prime-storage";

const storage = new GithubArtifactStorage({ /* ... */ });
const store = new GithubPublishIndexStore(storage);

// Register a published package (idempotent: re-publishing the same
// content returns "already-published").
const result = await store.registerPublishedPackage({
  phase: "PRIMES",
  packageId: 1,
  archive: zipBytes,
  blockRange: { first: 0, size: 100 },
  generatorVersion: "1.0.0",
  wheelVersion: "1.0.0",
});

// Query
const packages = await store.getPublishedPackages("PRIMES");
const one = await store.getPublishedPackage("PRIMES", 1);
const bytes = await store.getPublishedArchive("PRIMES", 1);

// Integrity verification (sha256 + sizeBytes against the index entry)
await store.verifyPublishedArchive("PRIMES", 1);

// Adapters for the API layer
const phaseIndex = await phaseIndexFromStore(store, "PRIMES");
const published: { entry: PublishIndexEntry; bytes: Uint8Array } | null =
  await publishedPackageFromStore(store, "PRIMES", 1);
```

A local equivalent (`LocalPublishIndexStore` over `LocalArtifactStorage`) is
available for tests and local development.

---

## Errors

- `GithubStorageError` — GitHub API failures (auth, network, HTTP errors).
- `PublishIndexError` — publish-index failures, with codes such as
  `PACKAGE_NOT_FOUND`, `PACKAGE_ARCHIVE_MISSING`, `ARCHIVE_INTEGRITY_ERROR`,
  `GITHUB_INDEX_INVALID`.

---

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # vitest run
```

## Versioning

Versions are tagged in git (`v1.1.0`, ...). Pin a tag in your dependency to
get reproducible installs; `#main` tracks the tip of the branch.
