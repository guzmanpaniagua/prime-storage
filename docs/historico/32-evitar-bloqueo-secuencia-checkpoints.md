Objetivo:

Evitar que una publicación parcialmente completada pueda bloquear permanentemente la secuencia de checkpoints.

Contexto:

Hoy el flujo es:

1. registerPublishedPackage()
   - publica ZIP
   - publica publish-index

2. publishPackage()
   - publica checkpoints

Si el proceso falla entre ambos pasos:

- el paquete queda publicado
- el checkpoint no existe

En un reintento:

- registerPublishedPackage() devuelve already-published
- publishPackage() no vuelve a escribir checkpoints

Esto puede dejar la campaña bloqueada permanentemente.

Objetivo del cambio:

Convertir la publicación de checkpoints en una operación idempotente recuperable mediante reintento.

Tareas:

1. Analizar únicamente el flujo actual.

2. Diseñar la solución mínima.

Evaluar estas opciones:

A)
Ejecutar siempre la publicación de checkpoints,
incluso cuando registerPublishedPackage()
devuelva already-published.

B)
Cuando se detecte GITHUB_CHECKPOINT_MISSING
en una publicación ya existente,
reconstruir/escribir los checkpoints
y continuar.

C)
Otra alternativa más simple.

3. Elegir una única solución.

4. Explicar:

- por qué elimina el bloqueo permanente
- por qué mantiene compatibilidad
- qué cambios mínimos requiere

5. No implementar código.

6. No modificar APIs.

Entregar únicamente el diseño final recomendado.