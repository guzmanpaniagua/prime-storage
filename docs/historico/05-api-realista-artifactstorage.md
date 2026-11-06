Objetivo:

Convertir ArtifactStorage en una API más realista.

Tareas:

1. Crear:

src/models/stored-artifact.ts

export interface StoredArtifact {
  reference: ArtifactReference;
  metadata: ArtifactMetadata;
  data: ArtifactContent;
}

2. Añadir a ArtifactStorage:

getMetadata(
  reference: ArtifactReference
): Promise<ArtifactMetadata>;

3. Implementar getMetadata() en LocalArtifactStorage.

Debe recuperar únicamente metadata.

4. Añadir tests:

- guardar artefacto
- recuperar metadata
- verificar igualdad

5. Exportar StoredArtifact.

6. Build y tests en verde.

Importante:

No introducir GitHub todavía.
No modificar ZipService.