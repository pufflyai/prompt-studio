import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeRecoveryKey } from "./recovery-key";

test("concurrent operator initialization preserves one durable key and rejects a corrupt existing file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-recovery-key-"));
  const path = join(directory, "key");
  try {
    const keys = await Promise.all(Array.from({ length: 20 }, () => initializeRecoveryKey(path)));
    expect(new Set(keys.map((key) => key.toString("hex"))).size).toBe(1);
    expect(keys[0].byteLength).toBe(32);
    expect(await initializeRecoveryKey(path)).toEqual(keys[0]);
    expect(await readdir(directory)).toEqual(["key"]);
    await writeFile(path, "invalid-key");
    const error = await initializeRecoveryKey(path).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(await readFile(path, "utf8")).toBe("invalid-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
