Estamos construyendo una librería llamada prime-storage.

No quiero todavía implementación real de GitHub ni ZIP.

Objetivo:
Definir únicamente los contratos públicos y modelos base que utilizará el resto del proyecto.

Tareas:

1. Crear src/contracts/artifact-storage.ts

Definir:

export interface ArtifactMetadata {
  type: string;
  version: string;
}

export interface ArtifactReference {
  id: string;
  path: string;
}

export interface ArtifactStorage {
  save(
    data: unknown,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference>;

  load(
    reference: ArtifactReference
  ): Promise<unknown>;
}

2. Crear src/models/artifact.ts

Mover allí ArtifactMetadata y ArtifactReference si tiene más sentido arquitectónicamente.

3. Crear src/index.ts

Exportar todos los contratos y modelos públicos.

4. Crear tests/contracts.test.ts

Añadir al menos un test simple que compruebe que las interfaces y exports compilan correctamente. No necesito tests funcionales todavía.

5. Ejecutar:

npm run build
npm test

6. Corregir cualquier error hasta que ambos comandos terminen correctamente.

Importante:

- No crear todavía GithubArtifactStorage.
- No crear todavía compresión ZIP.
- No copiar código desde otros repositorios.
- Mantener el código lo más pequeño posible.
- Mostrar todos los archivos creados o modificados.