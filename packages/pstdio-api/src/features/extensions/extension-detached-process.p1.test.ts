import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, watch } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

test.each([0, 1500])("a detached extension command outlives its host after %ims startup", async (startupDelay) => {
  const home = mkdtempSync(join(tmpdir(), "extension-detached-"));
  const heartbeat = join(home, "heartbeat.json");
  const ready = Promise.withResolvers<{ pid: number; tick: number }>();
  const watcher = watch(home, () => {
    if (existsSync(heartbeat)) ready.resolve(JSON.parse(readFileSync(heartbeat, "utf8")));
  });
  watcher.on("error", ready.reject);
  void ready.promise.catch(() => {});
  const childScript = `
    const fs = require("node:fs");
    const path = ${JSON.stringify(heartbeat)};
    let tick = 0;
    let timer;
    setTimeout(() => { clearInterval(timer); process.exit(0); }, 10000);
    await Bun.sleep(${startupDelay});
    timer = setInterval(() => {
      fs.writeFileSync(path + ".tmp", JSON.stringify({ pid: process.pid, tick: ++tick }));
      fs.renameSync(path + ".tmp", path);
    }, 50);
  `;
  const hostScript = `
    import { createProcessApi } from ${JSON.stringify(new URL("./extension-process-api.ts", import.meta.url).href)};
    const detached = await createProcessApi().spawnDetached({ command: [process.execPath, "--eval", ${JSON.stringify(childScript)}] });
    process.send(detached);
    process.disconnect();
  `;
  let childPid: number | undefined;
  const spawned = Promise.withResolvers<number>();
  void spawned.promise.catch(() => {});
  const host = Bun.spawn([process.execPath, "--eval", hostScript], {
    // This host must allow descendants to outlive it. The test runner still owns cleanup.
    env: { ...process.env, BUN_FEATURE_FLAG_NO_ORPHANS: "0" },
    stdout: "ignore",
    stderr: "pipe",
    ipc(message) {
      childPid = (message as { pid: number }).pid;
      spawned.resolve(childPid);
    },
  });
  const stderr = new Response(host.stderr).text();
  void host.exited.then(async (code) => {
    if (code !== 0) {
      const error = new Error(`Detached fixture host failed (${code}): ${await stderr}`);
      ready.reject(error);
      spawned.reject(error);
    }
  });
  cleanups.push(async () => {
    watcher.close();
    ready.reject(new Error("Detached fixture ended"));
    if (host.exitCode === null) host.kill("SIGKILL");
    if (childPid) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {}
    }
    await host.exited;
    await stderr;
    rmSync(home, { recursive: true, force: true });
  });
  const started = await ready.promise;
  const pid = await spawned.promise;
  expect(started.pid).toBe(pid);
  const exit = await Promise.race([host.exited, Bun.sleep(1_000).then(() => "still running")]);
  expect(exit).toBe(0);
  const stoppedTick = (JSON.parse(readFileSync(heartbeat, "utf8")) as { tick: number }).tick;
  await Bun.sleep(150);
  const afterExit = JSON.parse(readFileSync(heartbeat, "utf8")) as { pid: number; tick: number };
  expect(afterExit.pid).toBe(pid);
  expect(afterExit.tick).toBeGreaterThan(stoppedTick);
});
