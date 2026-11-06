Objetivo:

Evaluar el impacto de haber separado la publicación de:

- ZIP
- publish-index
- checkpoints

en operaciones distintas.

Contexto:

Antes:

commitFiles([
  zip,
  publish-index,
  checkpoints
])

hacía un único commit GitHub.

Ahora:

registerPublishedPackage()

realiza un commit para:

- ZIP
- publish-index

y posteriormente publishPackage() hace otro commit para:

- checkpoints

Tareas:

1. Analizar todos los flujos que leen:

- checkpoints
- publish-index
- packages publicados

2. Determinar si puede existir una ventana de inconsistencia observable.

Ejemplos:

- índice apunta a un paquete válido pero falta checkpoint.
- checkpoint apunta a un paquete todavía no publicado.
- reintentos posteriores.

3. Clasificar:

A) Sin impacto práctico.

B) Impacto tolerable.

C) Rompe invariantes del sistema.

4. Si existe impacto:

proponer la solución mínima.

No implementar nada.
No modificar código.
Solo análisis.