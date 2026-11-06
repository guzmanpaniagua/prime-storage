Continuamos con prime-storage.

Objetivo:

Definir la configuración y los tipos necesarios para una futura implementación GithubArtifactStorage.

Todavía NO quiero llamadas HTTP a GitHub.

Tareas:

1. Crear:

src/github/github-storage-config.ts

export interface GithubStorageConfig {
  owner: string;
  repository: string;
  branch: string;
  token: string;
}

2. Crear:

src/github/github-artifact-location.ts

export interface GithubArtifactLocation {
  path: string;
  sha?: string;
  downloadUrl?: string;
}

3. Crear:

src/github/github-artifact-metadata.ts

export interface GithubArtifactMetadata {
  storageType: "github";
  owner: string;
  repository: string;
  branch: string;
  path: string;
}

4. Exportar todos estos modelos desde src/index.ts.

5. Crear tests/github-types.test.ts

Tests sencillos de compilación/asignación de tipos, igual que hicimos con los contratos iniciales.

6. No instalar dependencias nuevas.

7. No hacer llamadas a GitHub.

8. No crear GithubArtifactStorage todavía.

9. Ejecutar:

npm run build
npm test

10. Corregir cualquier error.

Importante:

- Solo modelos y contratos.
- Nada de fetch.
- Nada de APIs REST.
- Nada de autenticación todavía.
- Mostrar todos los cambios realizados.