import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBuildCache } from "./build-cache";

test("the job cache stays available after its setup process exits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-build-cache-launch-"));
  let pid: number | undefined;
  try {
    const environment = join(directory, "github-env");
    const setup = Bun.spawn([process.execPath, join(import.meta.dirname, "build-cache.ts")], {
      cwd: directory,
      env: { ...process.env, RUNNER_TEMP: directory, GITHUB_ENV: environment },
      detached: true,
      stdout: "ignore",
      stderr: "inherit",
    });
    expect(await setup.exited).toBe(0);
    const ready = JSON.parse(await readFile(join(directory, "ci-build-cache-ready"), "utf8"));
    pid = ready.pid;
    // Emulate the setup shell's process-group cleanup on POSIX. Windows does this on exit.
    if (process.platform !== "win32") {
      try {
        process.kill(-setup.pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    const url = (await readFile(environment, "utf8")).trim().split("=").slice(1).join("=");
    expect((await fetch(`${url}/v1/cache/missing`)).status).toBe(404);
  } finally {
    if (pid) {
      try {
        process.kill(pid);
      } catch {}
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("portable task archives survive a cache server restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-build-cache-"));
  let server = createBuildCache(directory);
  try {
    const path = "/v1/cache/123456789";
    expect((await fetch(new URL(path, server.url))).status).toBe(404);
    const bytes = new Uint8Array([0, 255, 12, 34]);
    expect((await fetch(new URL(path, server.url), { method: "PUT", body: bytes })).status).toBe(200);
    expect((await fetch(new URL(path, server.url), { method: "PUT", body: new Uint8Array([99]) })).status).toBe(409);
    await server.stop(true);
    server = createBuildCache(directory);
    expect(new Uint8Array(await (await fetch(new URL(path, server.url))).arrayBuffer())).toEqual(bytes);
    expect(server.hostname).toBe("127.0.0.1");
  } finally {
    await server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
