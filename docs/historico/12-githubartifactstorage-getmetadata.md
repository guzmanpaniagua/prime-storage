Objetivo:

Implementar GithubArtifactStorage.getMetadata().

Tareas:

1. Utilizar GithubClient.readFile().

2. Leer artifacts/<id>.json usando la path contenida en ArtifactReference.

3. Parsear el JSON.

4. Validar que existe:

{
  reference,
  metadata,
  data
}

5. Devolver únicamente metadata.

6. Crear errores específicos si:

- JSON inválido
- metadata ausente
- estructura inesperada

utilizando GithubStorageError.

7. Añadir tests:

- save()
- getMetadata()

Verificar que la metadata recuperada coincide exactamente con la guardada.

8. Mantener compatibilidad con los tests actuales.

9. Build y tests en verde.