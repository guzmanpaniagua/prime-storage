Objetivo:

Determinar cuánto de getCampaignCheckpoint()
ya está cubierto por CampaignCheckpointStore.

Contexto:

Ahora existen:

- CampaignCheckpointStore
- LocalCampaignCheckpointStore
- GithubCampaignCheckpointStore

Analizar:

getCampaignCheckpoint()

y clasificar cada bloque en:

A) Ya cubierto por CampaignCheckpointStore

B) Sigue siendo negocio del monolito

C) Falta capacidad en CampaignCheckpointStore

Generar una tabla:

| Bloque | Categoría | Motivo |
|---------|----------|---------|

Prestar especial atención a:

- lectura de latest.json
- lectura de snapshot
- validación de hashes
- validación de cursores
- validación de artefacto
- comparación con packageIndex remoto
- tipos de artefacto
- coherencia snapshot ↔ pointer

Entregar además:

pseudocódigo aproximado de cómo quedaría
getCampaignCheckpoint()
si delegara en el store.

No implementar nada.

No modificar código.

Solo auditoría.