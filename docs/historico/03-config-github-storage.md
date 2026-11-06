Continuamos con prime-storage.

Objetivo:

Preparar ArtifactStorage para soportar tanto JSON como contenido binario futuro (ZIPs) sin romper compatibilidad.

Tareas:

1. Modificar src/contracts/artifact-storage.ts

Definir:

export type ArtifactContent =
  | unknown
  | Uint8Array;

Actualizar:

save(
  data: ArtifactContent,
  metadata: ArtifactMetadata
): Promise<ArtifactReference>;

load(
  reference: ArtifactReference
): Promise<ArtifactContent>;

2. Crear:

src/models/artifact-content.ts

Mover allí ArtifactContent si encaja mejor en la arquitectura.

3. Revisar LocalArtifactStorage.

Debe seguir funcionando para JSON.

Si recibe Uint8Array:

- Guardarlo codificado en base64.
- Persistir también un campo que identifique el tipo de contenido.

Ejemplo:

{
  "contentType": "binary",
  "data": "base64..."
}

o

{
  "contentType": "json",
  "data": {...}
}

4. Actualizar load()

Si contentType es:

- json → devolver objeto JSON
- binary → devolver Uint8Array reconstruido

5. Añadir test nuevo:

Guardar un Uint8Array.

Leerlo.

Verificar:

result instanceof Uint8Array

y comparar byte a byte.

Ejemplo:

new Uint8Array([1,2,3,4,5])

6. Mantener el test JSON existente.

7. Exportar ArtifactContent desde src/index.ts.

8. Ejecutar:

npm run build
npm test

9. Corregir cualquier error.

Importante:

- No introducir ZIP todavía.
- No introducir GitHub todavía.
- No usar fflate todavía.
- No romper la API pública existente.
- Mostrar todos los cambios realizados.