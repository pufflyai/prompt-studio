import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("a detached extension command outlives its host without delaying host exit", async () => {
  const home = mkdtempSync(join(tmpdir(), "extension-detached-"));
  const heartbeat = join(home, "heartbeat.json");
  const childScript = `
    const fs = require("node:fs");
    const path = ${JSON.stringify(heartbeat)};
    let tick = 0;
    const timer = setInterval(() => {
      fs.writeFileSync(path + ".tmp", JSON.stringify({ pid: process.pid, tick: ++tick }));
      fs.renameSync(path + ".tmp", path);
    }, 50);
    setTimeout(() => { clearInterval(timer); process.exit(0); }, 10000);
  `;
  const hostScript = `
    import { createProcessApi } from ${JSON.stringify(new URL("./extension-process-api.ts", import.meta.url).href)};
    await createProcessApi().spawnDetached({ command: [process.execPath, "--eval", ${JSON.stringify(childScript)}] });
  `;
  const host = Bun.spawn([process.execPath, "--eval", hostScript], {
    // This host must allow descendants to outlive it. The test runner still owns cleanup.
    env: { ...process.env, BUN_FEATURE_FLAG_NO_ORPHANS: "0" },
    stdout: "ignore",
    stderr: "pipe",
  });
  let childPid: number | undefined;
  try {
    // Process startup speed is not this test's contract; it waits within the test's own deadline.
    while (!existsSync(heartbeat)) {
      if (host.exitCode !== null && host.exitCode !== 0) throw new Error(await new Response(host.stderr).text());
      await Bun.sleep(10);
    }
    const started = JSON.parse(readFileSync(heartbeat, "utf8")) as { pid: number; tick: number };
    childPid = started.pid;
    // A host that waited for its 10-second child would stop the heartbeat checked below.
    expect(await host.exited).toBe(0);
    const stoppedTick = (JSON.parse(readFileSync(heartbeat, "utf8")) as { tick: number }).tick;
    await Bun.sleep(150);
    const afterExit = JSON.parse(readFileSync(heartbeat, "utf8")) as { pid: number; tick: number };
    expect(afterExit.pid).toBe(childPid);
    expect(afterExit.tick).toBeGreaterThan(stoppedTick);
  } finally {
    if (host.exitCode === null) host.kill("SIGKILL");
    if (childPid) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {}
    }
    await host.exited;
    rmSync(home, { recursive: true, force: true });
  }
});
