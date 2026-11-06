Objetivo:

Implementar operaciones GitHub genéricas de lectura.

Tareas:

1. Crear:

src/github/github-client.ts

2. Mover desde 
githubPublicationService.ts que esta en docs
 únicamente:

- request()
- apiError()
- readFile()
- readBinaryFile()

3. Adaptarlos para que no dependan de:

- ApiError
- checkpoints
- campaigns
- phases
- products
- primes

4. Crear errores propios de prime-storage.

5. GithubArtifactStorage.load()
debe empezar a utilizar github-client.

6. No implementar save() todavía.

7. No migrar commitFiles() todavía.

8. Build y tests en verde.

