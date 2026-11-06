Objetivo:

Crear GithubProjectStateStore siguiendo exactamente el patrón utilizado por GithubPublishIndexStore.

Contexto:

Ya existen:

- ProjectStateStore
- LocalProjectStateStore
- ProjectStateError
- project-state-core

Queremos la implementación GitHub reutilizando GithubArtifactStorage.

Tareas:

1. Crear:

src/usecases/project-state/github-project-state-store.ts

2. Constructor:

constructor(
  storage: GithubArtifactStorage
)

3. Implementar:

getProjectState()

saveProjectState()

utilizando exclusivamente:

- ArtifactStorage
- project-state-core

4. No depender de GithubClient.

5. Toda la persistencia debe pasar por GithubArtifactStorage.

6. Compartir el 100% de la lógica posible con LocalProjectStateStore.

Si aparece duplicación:

extraer helper común.

7. Crear tests con fetch simulado.

Verificar:

- estado inexistente → null
- lectura válida
- persistencia
- documento corrupto → PHASES_INVALID

8. Exportar:

GithubProjectStateStore

9. Build y tests verdes.

Importante:

No tocar PublishIndexStore.

No tocar checkpoints.

No añadir nuevos formatos.

Mantener exactamente:

{
  phases,
  audit
}


-----
Migrar getProjectState() del monolito a ProjectStateStore.

Mismo enfoque usado en:

- getPhaseIndex()
- getPublishedPackageArchive()

Mantener:
- misma firma
- mismo retorno
- mismos ApiError

Traducir:

PHASES_INVALID
→
ApiError 502 GITHUB_PHASES_INVALID

No tocar saveProjectPhases() todavía.

Build y tests verdes.
----

Migrar saveProjectPhases()
a GithubProjectStateStore.