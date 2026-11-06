Objetivo:

Eliminar la lógica propia de PublishIndex de GitHubPublicationService.

Preparar la migración usando PublishIndexStore.

Tareas:

1. Analizar:

- getPhaseIndex()
- getPublishedPackageArchive()
- getAllIndexes()

2. Comparar su comportamiento con:

PublishIndexStore
GithubPublishIndexStore

3. Generar una tabla:

| Método actual | Cubierto por PublishIndexStore | Falta funcionalidad | Acción |
|---------------|-------------------------------|---------------------|---------|

4. Identificar exactamente qué métodos podrían sustituirse ya mismo por llamadas a:

- getPublishedPackages()
- getPublishedPackage()
- getPublishedArchive()

5. No modificar código.

6. No implementar nada.

7. Entregar únicamente el análisis.