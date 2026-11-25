import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessAlive } from "pstdio-paths";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { type BackendWorker, startBackendWorker } from "./supervisor";

const cleanLateChildren = async (path: string) => {
  const marker = Bun.file(path);
  if (!(await marker.exists())) return;
  const { late, anchor } = await marker.json();
  for (const pid of [late, anchor]) {
    if (pid > 0 && isProcessAlive(pid)) process.kill(pid, "SIGKILL");
  }
};

test.each([
  "watchdog",
  "explicit stop",
  ...(process.platform === "win32" ? [] : (["late child"] as const)),
] as const)("%s waits for the worker and its live harness's children to stop", async (mode) => {
  const root = await mkdtemp(join(tmpdir(), "watchdog-agent-"));
  const entry = join(root, "watchdog-detached-agent.ts");
  const graceful = join(root, "graceful");
  const lateChild = join(root, "late-child");
  const sleep = "setInterval(() => {}, 1000)";
  let worker: BackendWorker | undefined;
  let peer: Bun.Subprocess | undefined;
  let agentPid: number | undefined;
  try {
    await writeFile(
      entry,
      `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
export default { commands: [{ id: "agent", async start(_ctx, graceful, lateChild) {
  let stops = 0;
  process.on("SIGTERM", () => {
    if (++stops !== 1) return;
    if (lateChild) {
      const table = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,pgid=,comm="]).stdout.toString();
      const anchor = table.split("\\n").map((line) => line.trim().split(/\\s+/)).find(
        ([, parent, group, command]) =>
          Number(parent) === process.pid && Number(group) === process.pid && /(?:^|\\/)sleep$/.test(command),
      );
      const late = Bun.spawn([process.execPath, "-e", ${JSON.stringify(sleep)}], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      writeFileSync(lateChild, JSON.stringify({ late: late.pid, anchor: Number(anchor?.[0]) || null }));
      process.exit(0);
    }
    setTimeout(async () => {
      await Bun.write(graceful, String(stops));
      process.exit(0);
    }, 30);
  });
  const child = spawn(process.execPath, ["-e", ${JSON.stringify(sleep)}], {
    detached: process.platform !== "win32", stdio: "ignore", windowsHide: true,
  });
  await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  return { workerPid: process.pid, agentPid: child.pid, hang() { while (true); } };
} }] };`,
    );
    worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath: entry,
      watchdog: { heartbeatMs: 20, unresponsiveMs: 500 },
    });
    peer = Bun.spawn([process.execPath, "-e", sleep], {
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "ignore"],
    });
    const definition = worker.definition as { commands: { start: { [HANDLER_MARKER]: string } }[] };
    const session = (await worker.invoke({
      handlerId: definition.commands[0].start[HANDLER_MARKER],
      surface: { kind: "object", members: {} },
      context: {},
      args: [graceful, mode === "late child" ? lateChild : undefined],
    })) as { workerPid: number; agentPid: number; hang(): Promise<void> };
    agentPid = session.agentPid;
    expect(isProcessAlive(agentPid)).toBe(true);
    expect(isProcessAlive(peer.pid)).toBe(true);
    if (mode === "watchdog") await expect(session.hang()).rejects.toThrow("did not respond");
    else {
      const results = await Promise.allSettled([worker.stop(), worker.stop()]);
      if (mode === "late child") {
        const { late, anchor } = await Bun.file(lateChild).json();
        expect(late).toBeGreaterThan(0);
        expect(anchor).toBeGreaterThan(0);
        expect({ late: isProcessAlive(late), anchor: isProcessAlive(anchor) }).toEqual({ late: false, anchor: false });
      }
      for (const result of results) expect(result.status === "fulfilled" ? "stopped" : result.reason).toBe("stopped");
    }
    await worker.exited;
    expect(isProcessAlive(session.workerPid)).toBe(false);
    if (mode === "explicit stop" && process.platform !== "win32") {
      expect(await Bun.file(graceful).text()).toBe("1");
    }
    expect({ worker: session.workerPid, agent: agentPid, alive: isProcessAlive(agentPid) }).toEqual({
      worker: session.workerPid,
      agent: agentPid,
      alive: false,
    });
    expect(isProcessAlive(peer.pid)).toBe(true);
  } finally {
    try {
      await worker?.stop().catch(() => {});
    } finally {
      if (agentPid && isProcessAlive(agentPid)) process.kill(agentPid, "SIGKILL");
      await cleanLateChildren(lateChild);
      peer?.kill("SIGKILL");
      await peer?.exited;
      await rm(root, { recursive: true, force: true });
    }
  }
});
