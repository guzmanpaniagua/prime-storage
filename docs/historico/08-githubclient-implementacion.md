Continuamos con prime-storage.

Objetivo:

Crear la primera implementación GithubArtifactStorage, pero todavía sin llamadas reales a GitHub.

Queremos fijar la API y compilar todo el proyecto.

Tareas:

1. Crear:

src/github/github-artifact-storage.ts

2. Implementar:

export class GithubArtifactStorage
  implements ArtifactStorage

3. Constructor:

constructor(
  config: GithubStorageConfig
)

Guardar la configuración en propiedades privadas readonly.

4. Implementar:

async save(
  data,
  metadata
): Promise<ArtifactReference>

async load(
  reference
): Promise<ArtifactContent>

async getMetadata(
  reference
): Promise<ArtifactMetadata>

5. Por ahora cada método debe lanzar:

throw new Error(
  "GithubArtifactStorage not implemented"
);

6. Exportar GithubArtifactStorage desde src/index.ts.

7. Crear:

tests/github-storage.test.ts

Verificar:

- puede instanciarse
- implementa ArtifactStorage
- los métodos lanzan el error esperado

8. Ejecutar:

npm run build
npm test

9. Corregir cualquier error.

Importante:

- No usar fetch.
- No instalar dependencias.
- No copiar código del repositorio principal.
- No implementar todavía GitHub.
- Solo fijar la estructura pública.