import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** SQL stores only an immutable file pointer. A page read opens only the payloads it selected. */
export const createLogPayloads = (directory: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  return {
    async encode(value: unknown) {
      const bytes = encoder.encode(JSON.stringify(value));
      const id = hash(bytes);
      await mkdir(directory, { recursive: true });
      const temporary = join(directory, `${id}.${crypto.randomUUID()}.tmp`);
      await writeFile(temporary, bytes);
      await rename(temporary, join(directory, `${id}.json`));
      return encoder.encode(id);
    },
    async decode<T>(pointer: Uint8Array) {
      const id = decoder.decode(pointer);
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid personal log payload pointer");
      const bytes = await readFile(join(directory, `${id}.json`));
      if (hash(bytes) !== id) throw new Error("Personal log payload changed");
      return JSON.parse(decoder.decode(bytes)) as T;
    },
  };
};
