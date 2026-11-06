Continuamos con prime-storage.

Objetivo:

Implementar completamente GithubArtifactStorage.load().

Tareas:

1. Utilizar GithubClient.readFile().

2. Leer el documento almacenado mediante ArtifactReference.path.

3. Parsear JSON.

4. Validar la estructura:

{
  reference,
  metadata,
  data
}

5. Devolver únicamente data.

6. Mantener compatibilidad con ArtifactContent:

- JSON normal -> devolver objeto
- Uint8Array serializado -> reconstruir Uint8Array

Si actualmente save() no distingue binario/JSON, dejar un TODO documentado para la futura integración con ZipService, pero implementar al menos el flujo JSON completo.

7. Reutilizar toda la validación posible entre:

- load()
- getMetadata()

Si aparece duplicación, crear helper privado.

8. Añadir tests:

- save + load JSON
- load archivo inexistente
- load JSON inválido
- load estructura inválida

9. Ejecutar:

npm run build
npm test

10. Corregir cualquier error.

Importante:

- No tocar ZipService aún.
- No añadir dependencias nuevas.
- No mover código del repositorio principal.
- No modificar GithubClient.