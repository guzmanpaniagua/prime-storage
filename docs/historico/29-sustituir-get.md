Objetivo:

Sustituir internamente getPublishedPackageArchive()
por prime-storage.

Contexto:

Ya existe:

- GithubPublishIndexStore
- publishedPackageFromStore()

getPhaseIndex() ya fue migrado correctamente.

Tareas:

1. Utilizar:

publishedPackageFromStore(
  publishIndexStore,
  phase,
  packageId
)

para implementar internamente
getPublishedPackageArchive().

2. Mantener exactamente:

- misma firma pública
- mismo tipo de retorno
- mismos ApiError observables

3. Traducir:

INVALID_PACKAGE_ID
→ ApiError 400 INVALID_PACKAGE_ID

PACKAGE_NOT_FOUND
→ ApiError 404 PACKAGE_NOT_FOUND

PACKAGE_ARCHIVE_MISSING
→ ApiError 502 GITHUB_PUBLISHED_ARCHIVE_MISSING

ARCHIVE_INTEGRITY_ERROR
→ ApiError 502 PACKAGE_ARCHIVE_HASH_MISMATCH

4. Eliminar:

- búsqueda manual en index.packages
- lectura manual del ZIP
- validación manual sha256/sizeBytes

si quedan cubiertas por el store.

5. No modificar:

- publishPackage()
- checkpoints
- project state

6. Medir:

- líneas eliminadas
- líneas añadidas

7. Build y tests verdes.

Objetivo final:

Que getPublishedPackageArchive() sea un wrapper fino sobre prime-storage.