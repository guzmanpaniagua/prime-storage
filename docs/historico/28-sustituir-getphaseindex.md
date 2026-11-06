Objetivo:

Sustituir internamente getPhaseIndex() por PublishIndexStore.

Contexto:

Ya existe:

- GithubPublishIndexStore
- phaseIndexFromStore()

Los modelos y las rutas ya están alineados con el consumidor.

Tareas:

1. Modificar GitHubPublicationService.

2. Inyectar (o recibir) una instancia de:

GithubPublishIndexStore

3. Reimplementar internamente:

getPhaseIndex()

utilizando:

phaseIndexFromStore(
  publishIndexStore,
  phase
)

4. Mantener exactamente:

- misma firma pública
- mismo tipo de retorno
- mismos ApiError públicos que observan los consumidores

5. Traducir:

PublishIndexError
→
ApiError

manteniendo compatibilidad.

6. No modificar:

- publishPackage()
- getPublishedPackageArchive()
- checkpoints
- project state

7. Actualizar tests.

8. Mostrar:

- diff
- líneas eliminadas
- líneas nuevas

9. Build y tests verdes.

Importante:

El objetivo es que ningún consumidor note el cambio.

Solo cambia la implementación interna de getPhaseIndex().