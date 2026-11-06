Continuamos con prime-storage.

Objetivo:
Crear una implementación local de ArtifactStorage para validar el diseño antes de implementar GitHub.

Tareas:

1. Crear:

src/local/local-artifact-storage.ts

2. Implementar:

export class LocalArtifactStorage
  implements ArtifactStorage

3. Comportamiento:

save(data, metadata)

- Generar un id único simple usando crypto.randomUUID()
- Crear una carpeta .storage si no existe
- Guardar un fichero JSON con:

{
  "reference": {
    "id": "...",
    "path": "..."
  },
  "metadata": { ... },
  "data": { ... }
}

- Nombre sugerido:
  .storage/<id>.json

- Devolver:

{
  id,
  path
}

4. load(reference)

- Leer el fichero JSON
- Devolver únicamente el contenido de data

5. Mantener compatibilidad con el contrato existente.

6. Crear tests/local-artifact-storage.test.ts

Test mínimo:

- Crear instancia
- Guardar un objeto
- Leerlo
- Verificar igualdad profunda

Ejemplo:

{
  hello: "world",
  value: 123
}

7. Exportar LocalArtifactStorage desde src/index.ts

8. Ejecutar:

npm run build
npm test

9. Corregir errores hasta dejar build y tests en verde.

Importante:

- No introducir dependencias GitHub.
- No introducir ZIP.
- No introducir conceptos de campaña, checkpoints, primos o productos.
- Es únicamente una implementación local para validar la API.
- Mostrar todos los archivos creados o modificados.