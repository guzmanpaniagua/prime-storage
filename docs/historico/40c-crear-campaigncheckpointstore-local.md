Objetivo:

Crear CampaignCheckpointStore mínimo.

Alcance:

Persistencia e integridad únicamente.

NO incluir todavía comparación con PublishIndexStore.

Tareas:

1. Crear:

src/usecases/campaign-checkpoints/campaign-checkpoint-error.ts

Definir errores tipados:

- CHECKPOINT_INVALID
- CHECKPOINT_SEQUENCE_CONFLICT
- CHECKPOINT_POINTER_CONFLICT
- CHECKPOINT_ARTIFACT_CONFLICT
- CHECKPOINT_HASH_MISMATCH

2. Crear:

src/usecases/campaign-checkpoints/campaign-checkpoint-store.ts

API inicial:

getCheckpoint(
  campaignId: string
)

publishCheckpoint(
  snapshot,
  archive,
  archivePath
)

3. Crear:

src/usecases/campaign-checkpoints/campaign-checkpoint-core.ts

Mover al core:

- construcción de pointer
- snapshotPath
- snapshotSha256
- validación de contratos
- validación de hashes
- secuencia creciente
- conflictos de rutas
- idempotencia alreadyPublished

4. NO mover todavía:

- comparación con índice remoto
- validación PRIME_SEARCH
- getCampaignPackage()
- getCampaignArchive()

5. Implementar:

LocalCampaignCheckpointStore

sobre ArtifactStorage.

6. Crear tests.

7. Exportar desde index.ts.

8. Build y tests verdes.