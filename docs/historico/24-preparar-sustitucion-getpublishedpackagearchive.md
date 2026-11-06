Objetivo:

Preparar la sustitución real de getPublishedPackageArchive() por PublishIndexStore.

Tareas:

1. Crear:

src/usecases/publish-index/published-package-adapter.ts

2. Implementar:

publishedPackageFromStore(
  store: PublishIndexStore,
  phase: PhaseType,
  packageId: number
)

3. Comportamiento esperado:

- validar packageId > 0

- obtener entry mediante:

getPublishedPackage()

- obtener bytes mediante:

getPublishedArchive()

- devolver:

{
  entry,
  bytes
}

4. Mantener equivalencia funcional con el método original:

getPublishedPackageArchive()

5. Mapear situaciones:

package inexistente
→ PACKAGE_NOT_FOUND

archive inexistente
→ PACKAGE_ARCHIVE_MISSING

error de integridad
→ ARCHIVE_INTEGRITY_ERROR

6. Crear tests:

- paquete válido
- packageId inválido
- package inexistente
- archive inexistente
- archive corrupto

7. No modificar todavía GitHubPublicationService.

8. No tocar publishPackage() todavía.

9. Entregar además una tabla:

| Aspecto | Método original | Adapter |
|----------|----------|----------|

para documentar diferencias.

10. Build y tests en verde.