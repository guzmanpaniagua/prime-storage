Objetivo:

Auditar Project State para extraerlo a prime-storage.

Analizar únicamente:

- getProjectState()
- saveProjectPhases()

Entregar una tabla:

| Elemento | Dominio | Persistencia | Motivo |
|-----------|----------|--------------|---------|

Determinar:

1. Qué modelos serían necesarios en prime-storage.

2. Qué parte de la lógica actual pertenece únicamente al almacenamiento.

3. Si puede existir un:

ProjectStateStore

análogo a PublishIndexStore.

4. Propuesta mínima de API.

Ejemplo orientativo:

getProjectState()
saveProjectState()

5. Identificar incompatibilidades potenciales con el formato actual.

No modificar código.

No implementar nada.

No tocar checkpoints.

No tocar campañas.

Solo análisis de Project State.