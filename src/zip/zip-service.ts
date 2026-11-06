import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

export interface ZipService {
  compressJson(data: unknown): Uint8Array;
  decompressJson<T>(zip: Uint8Array): T;
}

export class FflateZipService implements ZipService {
  compressJson(data: unknown): Uint8Array {
    const json = JSON.stringify(data);
    return zipSync({ "data.json": strToU8(json) });
  }

  decompressJson<T>(zip: Uint8Array): T {
    const files = unzipSync(zip);
    const json = strFromU8(files["data.json"] as Uint8Array);
    return JSON.parse(json) as T;
  }
}
