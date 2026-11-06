Objetivo:

Crear ProjectStateStore siguiendo exactamente el patrón utilizado por PublishIndexStore.

Contexto:

Debe persistir el contenido actual de project-phases.json sin cambios de formato.

Formato actual:

{
  "phases": [...],
  "audit": [...]
}

Requisitos:

- No añadir version.
- No añadir kind.
- No añadir metadata extra.
- Mantener compatibilidad completa con los ficheros existentes.

Tareas:

1. Crear:

src/usecases/project-state/project-state-types.ts

Definir:

export interface ProjectState<
  TPhase = unknown,
  TAudit = unknown
> {
  phases: TPhase[];
  audit: TAudit[];
}

2. Crear:

src/usecases/project-state/project-state-error.ts

Definir:

ProjectStateError

Código inicial:

PHASES_INVALID

3. Crear:

src/usecases/project-state/project-state-store.ts

Definir:

export interface ProjectStateStore {
  getProjectState(): Promise<ProjectState | null>;
  saveProjectState(
    state: ProjectState
  ): Promise<void>;
}

4. Crear:

src/usecases/project-state/project-state-core.ts

Responsabilidades:

- cargar documento
- parsear JSON
- validar únicamente:

  Array.isArray(phases)
  Array.isArray(audit)

- lanzar PHASES_INVALID si la estructura no coincide

- persistir exactamente:

{
  phases,
  audit
}

sin campos adicionales

5. Implementar:

LocalProjectStateStore

utilizando ArtifactStorage.

Referencia fija:

project-state/project-phases.json

6. Tests:

- inexistente -> null
- documento válido
- documento corrupto
- persistencia y lectura

7. Exportar todo desde index.ts

8. Build y tests verdes

Importante:

No crear GithubProjectStateStore todavía.

No tocar checkpoints.

No tocar PublishIndexStore.

No cambiar el formato actual del documento.