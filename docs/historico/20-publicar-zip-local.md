Objetivo:

Extender LocalPublishIndexStore para que publique realmente el ZIP, no solo el índice.

Tareas:

1. Añadir persistencia del archive.

Al registrar un paquete:

- guardar también el Uint8Array recibido
- reutilizar ArtifactStorage.saveAt()

2. La ruta física seguirá siendo interna.

Usar la convención actual:

<phase>/<filename>

pero no exponerla en la interfaz pública.

3. El PublishIndexEntry seguirá almacenando:

- filename
- sha256
- sizeBytes

pero esos valores deben corresponder al ZIP realmente persistido.

4. Añadir:

getPublishedArchive(
  phase,
  packageId
): Promise<Uint8Array | null>

al LocalPublishIndexStore.

5. Recuperar el ZIP usando la información del índice.

6. Verificar:

- existencia
- sizeBytes
- sha256

antes de devolverlo.

7. Tests:

- publicar ZIP
- recuperarlo
- hash correcto
- tamaño correcto
- paquete inexistente

8. No introducir GithubClient todavía.

9. Build y tests en verde.