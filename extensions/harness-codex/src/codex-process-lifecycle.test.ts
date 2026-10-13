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
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(import.meta.dir, "codex-process.fixture.ts"))} "$@"\n`,
    { mode: 0o755 },
  );
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${previousPath}`;
  const child = defaultSpawnProcess([]);
  process.env.PATH = previousPath;
  let descendant: number | undefined;
  try {
    const lines = createInterface({ input: child.stdout });
    const terminated = Promise.withResolvers<void>();
    const ready = Promise.withResolvers<void>();
    const pid = Promise.withResolvers<number>();
    lines.on("line", (line) => {
      if (line === "ready") ready.resolve();
      else if (line === "terminated") terminated.resolve();
      else pid.resolve(Number(line));
    });
    descendant = await pid.promise;
    expect(descendant).toBeGreaterThan(0);
    await ready.promise;
    const closed = new Promise<void>((resolve) => child.stdout.once("close", resolve));
    process.kill(child.pid!, "SIGKILL");
    await child.onExit;
    child.kill();
    // An exited orphan can retain its PID until the container's init reaps it.
    await terminated.promise;
    await closed;
    expect(child.stdout.destroyed).toBe(true);
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
