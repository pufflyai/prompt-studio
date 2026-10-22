import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startOpencodeServer } from "./opencode-server-process";

test("an owned server drains both log pipes after readiness and stops exactly once", async () => {
  const root = mkdtempSync(join(tmpdir(), "opencode-server-"));
  const marker = join(root, "drained");
  const pidPath = join(root, "pid");
  const source = `
    await Bun.write(${JSON.stringify(pidPath)}, String(process.pid));
    console.log("opencode server listening on http://127.0.0.1:4096");
    const { once } = await import("node:events");
    for (const stream of [process.stdout, process.stderr]) {
      for (let i = 0; i < 256; i++) {
        if (!stream.write("x".repeat(8192) + "\\n")) await once(stream, "drain");
      }
    }
    await Bun.write(${JSON.stringify(marker)}, "drained");
    setInterval(() => {}, 1000);
  `;
  let server: Awaited<ReturnType<typeof startOpencodeServer>> | undefined;
  try {
    server = await startOpencodeServer({ host: "127.0.0.1", port: 4096, signal: new AbortController().signal }, [
      process.execPath,
      "-e",
      source,
    ]);
    for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt++) await Bun.sleep(10);
    expect(existsSync(marker)).toBe(true);
    await Promise.all([server.dispose(), server.dispose()]);
    expect(() => process.kill(Number(readFileSync(pidPath, "utf8")), 0)).toThrow();
  } finally {
    await server?.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("aborting server startup waits for the unpublished child to exit", async () => {
  const root = mkdtempSync(join(tmpdir(), "opencode-startup-abort-"));
  const pidPath = join(root, "pid");
  const abort = new AbortController();
  const starting = startOpencodeServer({ host: "127.0.0.1", port: 4096, signal: abort.signal }, [
    process.execPath,
    "-e",
    `
      const fs = require("node:fs");
      const pidPath = ${JSON.stringify(pidPath)};
      fs.writeFileSync(pidPath + ".tmp", String(process.pid));
      fs.renameSync(pidPath + ".tmp", pidPath);
      setInterval(() => {}, 1000);
    `,
  ]);
  const result = starting.catch((error: unknown) => error);
  try {
    for (let attempt = 0; attempt < 100 && !existsSync(pidPath); attempt++) await Bun.sleep(10);
    expect(existsSync(pidPath)).toBe(true);
    const pid = Number(readFileSync(pidPath, "utf8"));
    expect(pid).toBeGreaterThan(0);
    abort.abort();
    expect(await result).toBeInstanceOf(Error);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    abort.abort();
    await result;
    rmSync(root, { recursive: true, force: true });
  }
});
