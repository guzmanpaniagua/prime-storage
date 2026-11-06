Objetivo:

Verificar que PublishIndexStore cubre completamente getPhaseIndex() del monolito.

Tareas:

1. Localizar el método:

GitHubPublicationService.getPhaseIndex()

2. Crear una función adaptadora temporal.

Ejemplo:

function phaseIndexFromStore(
  store: PublishIndexStore,
  phase: PhaseType
): Promise<PublishIndex>

3. Implementación:

- llamar a getPublishedPackages(phase)
- reconstruir:

{
  phase,
  packages
}

4. Verificar equivalencia funcional:

- índice inexistente
- índice válido
- índice corrupto

5. Comparar los resultados con el comportamiento actual del método original.

6. No eliminar todavía getPhaseIndex().

7. No modificar llamadas del resto del sistema.

8. Entregar:

- diferencias encontradas
- código que podría sustituir al método original

Sin refactors adicionales.
Sin mover checkpoints.
Sin tocar publishPackage().