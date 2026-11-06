Continuamos con prime-storage.

Objetivo:

Añadir soporte ZIP reutilizable como infraestructura interna de la librería.

Todavía NO quiero GitHub.

Tareas:

1. Instalar:

fflate

usando npm.

2. Crear:

src/zip/zip-service.ts

3. Definir una API simple:

export interface ZipService {
  compressJson(data: unknown): Uint8Array;
  decompressJson<T>(zip: Uint8Array): T;
}

4. Crear una implementación:

export class FflateZipService
  implements ZipService

5. Comportamiento:

compressJson(data)

- serializar JSON
- crear ZIP usando fflate
- devolver Uint8Array

decompressJson(zip)

- abrir ZIP
- recuperar JSON
- parsear
- devolver objeto

6. No depender de:

- GitHub
- checkpoints
- campaign
- prime
- product

Debe ser completamente genérico.

7. Crear:

tests/zip-service.test.ts

Test:

const payload = {
  hello: "world",
  numbers: [1,2,3,4,5]
};

const zip = compressJson(payload);

expect(zip).toBeInstanceOf(Uint8Array);

const result = decompressJson(zip);

expect(result).toEqual(payload);

8. Exportar ZipService y FflateZipService desde src/index.ts.

9. Ejecutar:

npm run build
npm test

10. Corregir errores hasta dejar todo en verde.

Importante:

