Objetivo:

Crear los modelos de PublishIndex dentro de prime-storage.

Tareas:

1. Crear:

src/usecases/publish-index/publish-index-types.ts

2. Definir:

PhaseType

PublishIndex

PublishIndexEntry

PublishPackageInput

PublishPackageResult

3. Copiar únicamente la estructura de datos.

No copiar validaciones.

No copiar funciones.

No copiar lógica de GitHub.

4. Exportar los tipos desde src/index.ts.

5. Crear tests de tipos.

6. Build y tests en verde.

Importante:

Todavía NO crear PublishIndexStore.

Todavía NO crear GithubPublishIndexStore.

Todavía NO mover lógica desde githubPublicationService.

Solo definir el modelo público que consumirá el resto de la librería.