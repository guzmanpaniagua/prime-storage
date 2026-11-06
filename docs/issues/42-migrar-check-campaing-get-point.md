Objetivo:

Migrar getCampaignCheckpoint() para delegar en CampaignCheckpointStore.

Contexto:

Ya existen:

- CampaignCheckpointStore
- GithubCampaignCheckpointStore

La auditoría del issue 41 concluyó que aproximadamente el 90% del método actual ya está cubierto por el store.

Tareas:

1. Inyectar o reutilizar GithubCampaignCheckpointStore dentro de GitHubPublicationService del mismo modo que:

- GithubPublishIndexStore
- GithubProjectStateStore

2. Reimplementar:

getCampaignCheckpoint()

utilizando:

checkpointStore.getCheckpoint(campaignId)

3. Mantener exactamente:

- misma firma
- mismo valor de retorno
- mismos ApiError observables

4. Traducir:

CHECKPOINT_INVALID
→ ApiError 502 GITHUB_CHECKPOINT_INVALID

CHECKPOINT_HASH_MISMATCH
→ ApiError 502 GITHUB_CHECKPOINT_HASH_MISMATCH

null
→ ApiError 404 CHECKPOINT_NOT_FOUND

5. Mantener fuera del store:

comparación con packageIndex remoto:

const remoteIndex =
  await this.getPhaseIndex(snapshot.phase);

si sigue siendo necesaria.

6. Eliminar toda lógica ya cubierta por el store:

- lectura de latest.json
- lectura de snapshot
- validación de hashes
- validación de cursores
- validación básica de artefactos
- validación de contratos

7. Entregar:

- diff resumido
- líneas eliminadas
- líneas añadidas
- pseudocódigo final del método

8. Build y tests verdes.

Importante:

No tocar publishCampaignCheckpoint() todavía.

No mover la comparación con el índice remoto si sigue siendo dependencia externa.

No modificar APIs públicas.