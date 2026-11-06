Objetivo:

Determinar exactamente qué parte de publishPackage() sigue siendo dominio
y qué parte ya está cubierta por PublishIndexStore.

Tareas:

1. Analizar publishPackage() completo.

2. Dividir cada bloque en una de tres categorías:

A) Ya cubierto por PublishIndexStore

B) Debe permanecer en el repositorio principal
(regla de negocio)

C) Falta una capacidad en prime-storage

3. Generar una tabla:

| Bloque | Categoría | Motivo |
|---------|----------|---------|

Ejemplos esperados:

- cálculo sha256
- generación filename
- actualización publish-index
- persistencia ZIP
- idempotencia
- validación PRODUCTS
- validación checkpoints
- secuencia de publicación
- comprobación de conflictos

4. Para los elementos de categoría C:

Proponer la mínima API adicional necesaria.

5. No modificar código.

6. No implementar nada.

7. No crear archivos.