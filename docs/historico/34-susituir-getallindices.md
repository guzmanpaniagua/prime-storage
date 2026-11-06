Objetivo:

Sustituir internamente getAllIndexes()
por prime-storage.

Contexto:

getPhaseIndex() ya utiliza:

phaseIndexFromStore()

y está funcionando.

Tareas:

1. Revisar:

getAllIndexes()

2. Sustituir su implementación interna por llamadas a:

getPhaseIndex()

o directamente a:

phaseIndexFromStore()

(según sea más simple y mantenga el comportamiento actual).

3. Mantener:

- misma firma
- mismo retorno
- misma semántica de errores

4. Eliminar cualquier lógica redundante relacionada con la lectura manual de índices.

5. Actualizar pruebas si existen.

6. Entregar:

- diff resumido
- líneas eliminadas
- líneas añadidas

7. Build y tests verdes.

Importante:

No tocar checkpoints.

No tocar publishCampaignCheckpoint().

No tocar project state.