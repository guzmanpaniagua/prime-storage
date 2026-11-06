Objetivo:

Preparar la reducción de publishPackage() usando PublishIndexStore.

Tareas:

1. Analizar el método publishPackage() actual.

2. Marcar cada bloque con una etiqueta:

// STORAGE
// BUSINESS
// CHECKPOINT

3. Generar una tabla:

| Fragmento | Categoría | Ya cubierto por PublishIndexStore | Acción |
|------------|-----------|-----------------------------------|---------|

4. Para los fragmentos STORAGE:

Indicar exactamente qué llamada sustituye cada bloque.

Ejemplo:

- getPhaseIndex()
  -> phaseIndexFromStore()

- persistencia ZIP
  -> registerPublishedPackage()

- verificación archive existente
  -> verifyPublishedArchive()

5. Identificar el código que quedaría tras la migración.

Entregar pseudocódigo aproximado:

async publishPackage(...) {
   ...
}

mostrando únicamente las llamadas de alto nivel.

6. No modificar código.

7. No implementar nada.

Solo análisis de sustitución.

