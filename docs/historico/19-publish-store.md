Objetivo:

Crear PublishIndexStore y una primera implementación local usando ArtifactStorage.

No GitHub todavía.

Queremos validar el modelo antes de acoplarlo a GithubClient.

Tareas:

1. Crear:

src/usecases/publish-index/publish-index-store.ts

Definir:

export interface PublishIndexStore {
  getPublishedPackages(
    phase: PhaseType
  ): Promise<readonly PublishIndexEntry[]>;

  getPublishedPackage(
    phase: PhaseType,
    packageId: number
  ): Promise<PublishIndexEntry | null>;

  registerPublishedPackage(
    input: PublishPackageInput
  ): Promise<PublishPackageResult>;
}

2. Crear:

src/usecases/publish-index/local-publish-index-store.ts

Implementación basada exclusivamente en ArtifactStorage.

3. Persistencia.

Usar ArtifactStorage internamente.

Guardar un índice por fase.

Todavía no importa dónde ni cómo.

No exponer rutas al consumidor.

4. registerPublishedPackage()

Debe:

- cargar el índice existente
- comprobar si packageId ya existe
- devolver "already-published" si la entrada coincide

Si no existe:

- calcular sha256 del archive
- calcular sizeBytes
- generar publishedAt
- generar filename usando la convención actual:
  <phase-prefix>-pack-XXXXXX.zip

- construir PublishIndexEntry completo

- añadirlo al índice

- persistir el índice actualizado

- devolver status = "registered"

5. Validaciones permitidas.

Solo validaciones de almacenamiento:

- packageId > 0
- phase válida
- packageId duplicado

NO mover todavía:

- reglas PRODUCTS
- reglas checkpoints
- reglas de negocio

6. Crear tests.

- índice vacío
- registrar primer paquete
- recuperar paquete
- idempotencia:
  mismo packageId + mismo hash
  => already-published

7. Exportar PublishIndexStore y LocalPublishIndexStore.

8. Build y tests en verde.

Importante:

No usar GithubClient.

No crear GithubPublishIndexStore todavía.

No copiar validaciones de negocio desde GitHubPublicationService.

El objetivo es demostrar que PublishIndex puede existir como caso de uso propio dentro de prime-storage.
