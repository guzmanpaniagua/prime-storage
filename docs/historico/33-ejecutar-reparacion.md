Objetivo:

Implementar la recuperación automática de checkpoints faltantes tras una publicación ya existente.

Contexto:

publishPackage() ya utiliza publishPackageViaStore().

Actualmente:

- registerPublishedPackage() puede devolver alreadyPublished.
- Si faltan checkpoints asociados:
  se lanza GITHUB_CHECKPOINT_MISSING.

Esto puede dejar campañas bloqueadas permanentemente
si el proceso falló después de publicar el ZIP y el índice.

Objetivo:

Convertir el reintento en mecanismo de recuperación.

Tareas:

1. Modificar publishPackage().

Eliminar el guard:

if (!result.alreadyPublished)

antes del commit de checkpoints.

Los checkpoints deben publicarse siempre cuando existan checkpointFiles.

2. Modificar la rama onAlreadyPublished().

Cuando se detecte:

- checkpoint faltante
- checkpoint distinto

y no exista un latest.json más nuevo
(isNewerCheckpointPointer)

no lanzar inmediatamente
GITHUB_CHECKPOINT_MISSING.

Marcar el checkpoint para reparación.

3. El commit final de checkpoints
debe escribir:

- checkpoints nuevos
- checkpoints reparados

de forma idempotente.

4. Mantener:

- CHECKPOINT_SEQUENCE_CONFLICT
- CHECKPOINT_POINTER_CONFLICT
- isNewerCheckpointPointer()

sin cambios.

5. Mantener mismas firmas públicas.

6. Actualizar documentación/comentarios si procede.

7. Entregar:

- diff resumido
- líneas eliminadas
- líneas añadidas
- nuevo flujo resumido

8. Build y tests verdes.

Importante:

No modificar prime-storage.

No introducir commitBatch.

No cambiar contratos públicos.

Solo hacer que los reintentos curen checkpoints faltantes automáticamente.