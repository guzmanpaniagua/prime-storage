Objetivo:

Crear los modelos públicos para Campaign Checkpoints.

Contexto:

Necesitamos representar exactamente los artefactos actualmente persistidos por el sistema.

Persistencia actual:

campaigns/<campaignId>/
  state/latest.json
  state/snapshots/checkpoint-<sequence>.json

Tareas:

1. Crear:

src/usecases/campaign-checkpoints/campaign-checkpoint-types.ts

2. Definir:

CampaignCheckpointPointer

CampaignCheckpointSnapshot

CampaignArtifactReference

CampaignArtifactKind

utilizando la estructura actual del sistema.

3. No implementar validaciones.

4. No implementar stores.

5. No implementar lógica GitHub.

6. Exportar los modelos desde index.ts.

7. Añadir tests de tipos.

8. Build y tests verdes.

Importante:

Copiar únicamente el modelo de datos.

No mover comportamiento todavía.