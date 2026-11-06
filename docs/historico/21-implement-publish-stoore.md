Objetivo:

Implementar GithubPublishIndexStore reutilizando GithubArtifactStorage.

Tareas:

1. Crear:

src/usecases/publish-index/github-publish-index-store.ts

2. Implementar PublishIndexStore.

3. Constructor:

constructor(
  storage: GithubArtifactStorage
)

No depender directamente de GithubClient.

Toda la persistencia debe pasar por ArtifactStorage.

4. Mantener exactamente el mismo comportamiento que LocalPublishIndexStore.

Métodos:

- getPublishedPackages()
- getPublishedPackage()
- registerPublishedPackage()
- getPublishedArchive()

5. Persistencia.

Usar las mismas referencias fijas:

publish-index/<phase>.json

y

<phase>/<filename>

para mantener compatibilidad entre implementaciones.

6. Extraer al máximo la lógica común.

Antes de copiar código desde LocalPublishIndexStore:

- identificar duplicaciones
- mover a helper compartido

Objetivo:

LocalPublishIndexStore
GithubPublishIndexStore

deben diferir únicamente en el ArtifactStorage utilizado.

7. Crear tests.

Utilizar GithubArtifactStorage con fetch simulado.

Verificar:

- registro
- lectura de índice
- lectura por packageId
- recuperación del ZIP

8. Build y tests en verde.

Importante:

No usar GithubClient directamente desde GithubPublishIndexStore.

No duplicar lógica de negocio ya existente en LocalPublishIndexStore.

La persistencia GitHub debe pasar exclusivamente por ArtifactStorage.