import { randomBytes, randomUUID } from "node:crypto";
import { link, open, readFile, rm } from "node:fs/promises";

// Operator initialization only. The serving runtime never replaces missing or invalid keys.
export const initializeRecoveryKey = async (path: string) => {
  const read = async () => {
    const key = await readFile(path);
    if (key.byteLength !== 32) throw new Error("Invalid existing relay recovery key");
    return key;
  };
  try {
    return await read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${path}.${randomUUID()}`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(randomBytes(32));
    await file.sync();
    await file.close();
    try {
      await link(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return await read();
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
};
