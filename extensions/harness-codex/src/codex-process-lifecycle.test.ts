import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { defaultSpawnProcess } from "./codex-process";

test.skipIf(process.platform === "win32")("kills native descendants after their launcher exits first", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-group-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "codex"),
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(import.meta.dir, "codex-process-fixture.ts"))} "$@"\n`,
    { mode: 0o755 },
  );
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${previousPath}`;
  const child = defaultSpawnProcess([]);
  process.env.PATH = previousPath;
  let descendant: number | undefined;
  try {
    const lines = createInterface({ input: child.stdout });
    descendant = await new Promise<number>((resolve) => lines.once("line", (line) => resolve(Number(line))));
    expect(descendant).toBeGreaterThan(0);
    process.kill(child.pid!, "SIGKILL");
    await child.onExit;
    child.kill();
    await new Promise<void>((resolve) => child.stdout.once("close", () => resolve()));
    let alive = true;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        process.kill(descendant, 0);
      } catch {
        alive = false;
        break;
      }
      await Bun.sleep(20);
    }
    expect(alive).toBe(false);
  } finally {
    child.kill();
    if (descendant) {
      try {
        process.kill(descendant, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});
