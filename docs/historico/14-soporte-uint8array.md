Objetivo:

Soportar correctamente Uint8Array
en LocalArtifactStorage y GithubArtifactStorage.

Tareas:

1. Formalizar almacenamiento binario:

{
  reference,
  metadata,
  contentType: "binary",
  data: "base64..."
}

2. Mantener:

{
  reference,
  metadata,
  contentType: "json",
  data: {...}
}

3. save()

Detectar Uint8Array automáticamente.

4. load()

Reconstruir Uint8Array.

5. Tests:

save/load JSON

save/load Uint8Array

save/load ZIP generado con FflateZipService

6. Build y tests en verde.