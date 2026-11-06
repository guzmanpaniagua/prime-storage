Objetivo:

Crear GithubCampaignCheckpointStore siguiendo exactamente el patrón de:

- GithubPublishIndexStore
- GithubProjectStateStore

Contexto:

Ya existen:

- CampaignCheckpointStore
- LocalCampaignCheckpointStore
- campaign-checkpoint-core

Queremos la implementación GitHub reutilizando GithubArtifactStorage.

Tareas:

1. Crear:

src/usecases/campaign-checkpoints/github-campaign-checkpoint-store.ts

2. Constructor:

constructor(
  storage: GithubArtifactStorage
)

3. Implementar:

getCheckpoint()

publishCheckpoint()

utilizando exclusivamente:

- ArtifactStorage
- campaign-checkpoint-core

4. No depender de GithubClient.

5. Compartir el 100% posible de la lógica con LocalCampaignCheckpointStore.

6. Crear tests con fetch simulado.

Verificar:

- checkpoint inexistente
- publicación correcta
- lectura correcta
- idempotencia alreadyPublished
- conflicto de secuencia
- hash mismatch

7. Exportar desde index.ts.

8. Build y tests verdes.

Importante:

No incluir todavía:

- comparación con PublishIndexStore
- getCampaignArchive()
- getCampaignPackage()
- PRIME_SEARCH
- workflow de recuperación

Solo persistencia de checkpoints.