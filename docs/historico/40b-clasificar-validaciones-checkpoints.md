Objetivo:

Clasificar todas las validaciones actuales de Campaign Checkpoints entre:

- Persistencia
- Negocio

Contexto:

Ya existen los modelos:

- CampaignCheckpointPointer
- CampaignCheckpointSnapshot
- CampaignArtifactReference

Analizar únicamente:

- getCampaignCheckpoint()
- publishCampaignCheckpoint()

Clasificar cada validación en una tabla:

| Validación | Persistencia | Negocio | Motivo |

Ejemplos a evaluar:

- schemaVersion
- campaignId
- sequence > 0
- snapshotPath determinista
- snapshotSha256
- hash snapshot ↔ puntero
- artifact.path
- artifact.sha256
- artifact.sizeBytes
- packageIndex válido
- snapshot.phase
- snapshot.jobType
- snapshot.sequence === pointer.sequence
- lastPublishedPackageId
- lastPublishedLogicalBlock
- nextLogicalBlockToPublish
- comparación con índice remoto de fase
- coherencia artifact ↔ packageEntry
- secuencia creciente respecto a latest.json
- conflicto de rutas inmutables
- idempotencia alreadyPublished

Entregar:

1. Tabla completa.

2. Resumen:

- Qué validaciones deberían vivir dentro de CampaignCheckpointStore.
- Qué validaciones deberían quedarse en el monolito.

3. Identificar cualquier dependencia con:
   - PublishIndexStore
   - ProjectStateStore

4. No implementar nada.

5. No modificar código.

6. No diseñar APIs nuevas todavía.

Solo clasificación.