Objetivo:

Añadir soporte de escritura genérica en GitHub.

Tareas:

1. Crear:

src/github/github-file.ts

export interface GithubFile {
  path: string;
  base64: string;
}

2. Mover fileExists()
desde el proyecto original a GithubClient.

3. Mover commitFiles()
desde el proyecto original a GithubClient.

4. Adaptarlo para utilizar:

GithubStorageError

en lugar de ApiError.

5. No depender de:

- phases
- campaigns
- checkpoints
- package types
- products
- primes

6. Crear tests unitarios utilizando fetch simulado.

Verificar:

- fileExists devuelve true para 200
- fileExists devuelve false para 404

Verificar además que commitFiles:

- realiza peticiones a blobs
- crea árbol
- crea commit
- actualiza referencia

No hace falta validar el contenido exacto.

7. Exportar GithubFile.

8. Build y tests en verde.