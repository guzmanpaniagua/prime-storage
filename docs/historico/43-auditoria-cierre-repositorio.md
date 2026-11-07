---
title: Auditoría de cierre y preparación de prime-storage
description: Hallazgos y backlog priorizado para llevar prime-storage v1.1.8 a un estado robusto, verificable y mantenible.
ms.date: 2026-11-07
ms.topic: architecture
---

# Auditoría de cierre y preparación de prime-storage

## Alcance y resultado

Auditoría del repositorio `prime-storage` en `main`, etiqueta `v1.1.8` (commit `167c482`). Se revisaron el código de almacenamiento local y GitHub, los casos de uso de índices/checkpoints/estado de proyecto, contratos, pruebas, configuración de paquete, README y archivos versionados.

La compilación, el typecheck de producción y de pruebas, y Vitest pasan: `npm run check` (17 archivos, 116 pruebas). Se añadieron regresiones con GitHub simulado, pero no se validó contra un repositorio GitHub real.

**Conclusión:** el núcleo funcional está implementado, pero todavía hay riesgos de integridad/seguridad y huecos de calidad de release que impiden considerar el paquete terminado con garantías de producción. Esta lista separa defectos concretos de tareas de endurecimiento y decisiones de distribución.

## Prioridad P0 — Diferido por decisión del usuario

- [ ] **Sanear la autenticación del remoto.** Diferido por el usuario para conservar el acceso de publicación a GitHub. No se modificó ni se consultó la configuración del remoto en esta tarea. Retomarlo cuando haya disponible un mecanismo alternativo.

## Prioridad P1 — Integridad y seguridad de persistencia

- [x] **Lecturas de artefactos GitHub grandes.** El storage consume el cuerpo raw mediante `readBinaryFile()` y valida UTF-8/estructura antes de deserializar. Se añadió una prueba determinista de documento binario serializado que supera 1 MB y prueba del encabezado raw. No se hizo una llamada a GitHub real.

- [x] **Aislamiento de rutas locales.** La raíz se normaliza; las referencias permanecen lógicas; se rechazan rutas absolutas, traversal y escapes por symlink. Se añadieron regresiones de round-trip y symlink. `saveManyAt()` sigue siendo secuencial y no atómico, como ya se documentaba.

- [x] **Distinguir ausencia de otros errores.** Índices, estado de proyecto, checkpoints, archivos y rutas inmutables toleran solo `ENOENT`/404 y propagan otros fallos. Se probaron errores de permisos y 5xx en caminos representativos; no se simuló cada combinación de proveedor.

- [x] **Validar el índice completo.** Al cargar se comprueba fase, entradas, metadata PRODUCTS, IDs únicos y orden ascendente; un índice inválido produce `INDEX_INVALID` y no se modifica silenciosamente. Se añadieron regresiones de fase, entrada, duplicación y orden.

## Prioridad P2 — Calidad de ingeniería y distribución

- [x] **Typecheck de tests.** Añadidos `tsconfig.test.json`, `typecheck:tests` y gate `check`; corregidos fixtures obsoletos. El typecheck completo pasa.

- [x] **Añadir CI.** El workflow verifica Node 22/24, instalación limpia, build, typecheck de tests, Vitest y empaquetado con smoke test en consumidor temporal. La protección obligatoria de ramas/tags depende de configuración externa en GitHub.

- [x] **Documentar instalación/versionado.** Los ejemplos usan `v1.1.8`, explican pin de tags y anotan Node 22+ (validado en CI con Node 22/24).

- [ ] **Completar metadatos legales.** Se añadieron descripción, keywords y `engines.node: >=22`; se eliminó `author` vacío. Se mantiene la declaración preexistente `ISC`, pero falta un archivo LICENSE y confirmar titular/copyright. No se inventó información legal.

- [x] **Revisar dependencias directas.** Retirado `zod` de `dependencies` y del lockfile: no se usa en `src` ni forma parte de la API pública.

- [ ] **Confirmar/cerrar el issue histórico 42.** Se actualizó `docs/issues/42-migrar-check-campaing-get-point.md` para indicar que falta confirmar la integración del consumidor. Este repositorio no contiene el servicio consumidor ni permite cerrarlo remotamente; se requiere el enlace/commit de esa integración.

## Validación adicional recomendada

- [x] Añadir cobertura mock para lectura raw grande y fallos representativos de transporte/permisos.
- [ ] Ejecutar integración GitHub real de archivo grande/commit batch y verificar instalación desde un tag en un consumidor limpio; CI valida el paquete empacado localmente, no una descarga GitHub real.
- [ ] Conservar explícita la limitación actual: `LocalArtifactStorage.saveManyAt()` es secuencial y no ofrece atomicidad/rollback. No es un defecto si los consumidores locales aceptan esa garantía; si se necesita atomicidad local, debe diseñarse y probarse como una capacidad separada.

## Ya implementado — No duplicar como pendiente

- [x] API pública exportada para storage local/GitHub, publish-index, estado de proyecto, checkpoints y ZIP.
- [x] Verificación de tamaño/SHA-256 de archivos publicados y de artefactos checkpoint descargados.
- [x] Publicación batch GitHub del ZIP, índice y artefactos asociados en un commit; fallback local secuencial documentado.
- [x] Validación estructural de entradas de índice, comparación de metadata PRODUCTS para idempotencia y validación del par checkpoint `latest`/snapshot en v1.1.8.
- [x] Gate ejecutado: 116 pruebas en 17 archivos; build y typecheck de tests correctos.

## Secuencia sugerida

1. Retomar el saneamiento de autenticación cuando haya un mecanismo alternativo de publicación.
2. Confirmar titular/licencia y añadir el archivo LICENSE aprobado.
3. Obtener referencia al commit del consumidor para cerrar o corregir el issue 42.
4. Ejecutar integración GitHub real e instalación desde tag cuando haya entorno de prueba disponible.
