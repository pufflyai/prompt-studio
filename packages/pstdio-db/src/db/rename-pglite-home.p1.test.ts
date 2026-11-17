import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renamePgliteHome } from "./rename-pglite-home";

test("cancelled database publication preserves the active home", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-publication-cancelled-"));
  const active = join(root, "active");
  const original = join(root, "original");
  await mkdir(active);
  await writeFile(join(active, "record"), "retained database bytes");
  const controller = new AbortController();
  const reason = new Error("Database opening was cancelled");
  controller.abort(reason);
  try {
    const failure = await renamePgliteHome(active, original, controller.signal).catch((error: unknown) => error);
    expect(failure).toBe(reason);
    expect(await readFile(join(active, "record"), "utf8")).toBe("retained database bytes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
