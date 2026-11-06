Objetivo:

Completar las capacidades que publishPackage() utiliza actualmente
y que todavía no existen en PublishIndexStore.

Tareas:

1. Añadir:

verifyPublishedArchive(
  phase: PhaseType,
  packageId: number
): Promise<void>

2. Implementación:

- cargar entry
- cargar archive
- verificar:

  sha256
  sizeBytes

- si algo no coincide:

  ARCHIVE_INTEGRITY_ERROR

3. Añadir:

ARCHIVE_EXISTS_UNINDEXED

a PublishIndexErrorCode.

4. Antes de persistir un nuevo archive:

comprobar si la referencia física ya existe.

Si existe pero no aparece en el índice:

lanzar
ARCHIVE_EXISTS_UNINDEXED

5. Implementar en:

- LocalPublishIndexStore
- GithubPublishIndexStore

manteniendo el core compartido.

6. Tests:

- archive válido
- hash mismatch
- size mismatch
- archive huérfano
- registro bloqueado por archive existente

7. Build y tests en verde.

Importante:

No tocar todavía checkpoints.

No crear commitBatch.

No modificar el monolito.
