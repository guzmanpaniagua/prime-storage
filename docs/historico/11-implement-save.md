Objetivo:

Implementar GithubArtifactStorage.save() utilizando GithubClient.

No utilizar todavía ZIP.

Guardar JSON plano.

Tareas:

1. Implementar save().

2. Generar:

const id = crypto.randomUUID();

3. Construir una ruta simple:

artifacts/<id>.json

4. Persistir mediante GithubClient.commitFiles():

{
  reference,
  metadata,
  data
}

serializado como JSON.

5. Devolver:

{
  id,
  path
}

6. Añadir helper privado:

buildArtifactDocument()

si mejora la legibilidad.

7. Crear tests con fetch simulado.

Verificar:

- save devuelve reference válida
- commitFiles recibe exactamente un archivo
- el contenido contiene:
  - reference
  - metadata
  - data

8. No utilizar ZipService todavía.

9. No implementar getMetadata todavía.

10. Build y tests en verde.