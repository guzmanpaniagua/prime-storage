Estamos creando un nuevo repositorio TypeScript llamado prime-storage.

Objetivo:
Crear únicamente el scaffolding mínimo para una librería npm moderna basada en TypeScript.

Tareas:

1. Inicializar package.json si no existe.

2. Instalar exactamente estas dependencias usando npm:

npm --registry=https://registry.npmjs.org install zod

npm --registry=https://registry.npmjs.org install -D typescript vitest tsx @types/node

3. Crear o actualizar tsconfig.json con configuración adecuada para una librería Node moderna:
- strict: true
- target: ES2022
- module: NodeNext
- moduleResolution: NodeNext
- declaration: true
- outDir: dist
- rootDir: src

4. Crear la estructura:

src/
src/contracts/
src/models/
src/github/
src/zip/
tests/

5. Crear src/index.ts

6. Configurar package.json con scripts:

{
  "build": "tsc",
  "test": "vitest run",
  "test:watch": "vitest"
}

7. No crear código de negocio.
8. No mover archivos de otros repositorios.
9. No añadir dependencias para GitHub todavía.
10. Mostrar todos los cambios realizados.

Importante:
Cuando sugieras comandos npm usa siempre npm, nunca pnpm ni yarn.