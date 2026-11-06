Objetivo:

Completar la integración entre ZipService, ArtifactContent, LocalArtifactStorage y GithubArtifactStorage.

Problema actual:

ArtifactContent soporta Uint8Array, pero GithubArtifactStorage no reconstruye todavía binarios de forma completa y consistente.
Existe un TODO pendiente para la recuperación de datos binarios.

Tareas:

1. Formalizar el formato persistido.

Extender ArtifactDocument persistido con:

contentType: "json" | "binary"

Ejemplos:

JSON:

{
  "reference": { ... },
  "metadata": { ... },
  "contentType": "json",
  "data": {
    "hello": "world"
  }
}

Binario:

{
  "reference": { ... },
  "metadata": { ... },
  "contentType": "binary",
  "data": "BASE64..."
}

2. Actualizar LocalArtifactStorage.

save()

- Detectar automáticamente Uint8Array.
- Persistir contentType="binary".
- Guardar data como base64.

load()

- Si contentType="binary":
  reconstruir Uint8Array.

- Si contentType="json":
  devolver el objeto original.

3. Actualizar GithubArtifactStorage.

save()

- Detectar automáticamente Uint8Array.
- Persistir contentType="binary".
- Guardar data como base64.

load()

- Si contentType="binary":
  devolver Uint8Array reconstruido.

- Si contentType="json":
  devolver el objeto original.

4. Centralizar la lógica común.

Si aparece código duplicado entre LocalArtifactStorage y GithubArtifactStorage:

- crear helper interno para:
  - serialización
  - deserialización
  - validación de ArtifactDocument

Evitar duplicar transformaciones base64.

5. Integración con ZipService.

Crear tests reales usando:

const zip = zipService.compressJson(payload)

Guardar mediante:

storage.save(zip, metadata)

Recuperar mediante:

storage.load(reference)

Descomprimir:

zipService.decompressJson(...)

Verificar igualdad profunda con payload.

6. Tests mínimos obligatorios.

LocalArtifactStorage

- save/load JSON
- save/load Uint8Array
- save/load ZIP

GithubArtifactStorage

- save/load JSON
- save/load Uint8Array
- save/load ZIP

7. Compatibilidad.

No romper:

- ArtifactStorage
- ArtifactContent
- ArtifactMetadata
- ArtifactReference
- ArtifactDocument

8. Ejecutar:

npm run build
npm test

Corregir errores hasta dejar todo en verde.

Importante:

- No modificar GithubClient.
- No tocar todavía el repositorio principal.
- No mover todavía código de githubPublicationService.
- El objetivo es dejar completamente cerrada la persistencia de binarios para que posteriormente podamos almacenar ZIPs de paquetes PRIMES, PRODUCTS y checkpoints sin más cambios de infraestructura.