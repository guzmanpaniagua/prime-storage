Objetivo:

Preparar el primer caso de uso de persistencia específico del sistema: PublishIndex.

Tareas:

1. Analizar el formato actual de:

PublishIndex
PublishIndexEntry

(procedente del repositorio principal).

2. No copiar todavía los tipos existentes.

3. Proponer una API de almacenamiento.

Ejemplo orientativo:

savePublishIndex(...)
loadPublishIndex(...)

4. La API no debe exponer:

- rutas
- carpetas
- nombres de zip
- publish-index.json

al consumidor.

5. La API sí puede exponer:

- phase
- packageId
- índices publicados

6. Entregar únicamente:

- propuesta de interfaces
- propuesta de ubicación de archivos
- dependencias necesarias

No implementar nada.
No crear archivos.
No escribir código.
Solo diseño.