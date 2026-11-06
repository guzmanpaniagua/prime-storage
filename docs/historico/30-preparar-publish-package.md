Objetivo:

Preparar la migración de publishPackage() hacia PublishIndexStore.

No quiero modificar checkpoints todavía.

Tareas:

1. Localizar dentro de publishPackage() todos los bloques STORAGE.

Ya sabemos que incluyen:

- búsqueda de existing
- comprobación de conflicts
- persistencia ZIP
- persistencia publish-index
- verificación archive publicado

2. Implementar un helper privado temporal:

publishPackageViaStore(...)

que encapsule únicamente la parte STORAGE usando:

- getPublishedPackage()
- verifyPublishedArchive()
- registerPublishedPackage()

3. Mantener publishPackage() llamando a ese helper.

4. No mover todavía:

- validatePackageCheckpointFiles()
- sameProductsPublication()
- validación PRODUCTS
- secuencia PRODUCTS
- checkpoints

5. Traducir:

PublishIndexError
→
ApiError

manteniendo exactamente los códigos actuales observables.

6. Entregar:

- diff
- líneas eliminadas de publishPackage()
- pseudocódigo final de publishPackage()

7. Build y tests verdes.

Importante:

No cambiar comportamiento observable.

No eliminar todavía lógica de checkpoints.

No simplificar validaciones de negocio.