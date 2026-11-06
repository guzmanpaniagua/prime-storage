Objetivo:

Revisar la API propuesta para PublishIndexStore.

Analizar si PublishIndexEntry contiene información que podría ser calculada automáticamente por la capa de almacenamiento.

Clasificar cada campo de PublishIndexEntry en:

1. Información del dominio (la debe aportar el llamador).
2. Información derivada del almacenamiento (la debería generar prime-storage).

Generar una tabla:

| Campo | Dominio | Storage | Motivo |

Proponer una versión refinada de:

publishPackage(...)

que minimice los detalles de almacenamiento visibles para el consumidor.

No implementar nada.

No crear archivos.

Solo diseño.