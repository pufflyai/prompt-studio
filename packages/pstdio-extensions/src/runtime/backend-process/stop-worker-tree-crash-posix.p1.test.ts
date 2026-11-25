import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessAlive } from "pstdio-paths";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { type BackendWorker, startBackendWorker } from "./supervisor";

const deadline = async <T>(operation: Promise<T>, message: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 3_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const readPid = async (path: string) => Number(await readFile(path, "utf8").catch(() => ""));

const waitForPid = async (path: string) => {
  const until = performance.now() + 2_000;
  while (performance.now() < until) {
    const pid = await readPid(path);
    if (pid > 0) return pid;
    await Bun.sleep(10);
  }
  throw new Error("The detached test process did not start.");
};

const stopFixtureProcess = async (path: string) => {
  const pid = await readPid(path);
  if (pid <= 0 || !isProcessAlive(pid)) return;
  process.kill(pid, "SIGKILL");
  const until = performance.now() + 2_000;
  while (isProcessAlive(pid) && performance.now() < until) await Bun.sleep(20);
  expect(isProcessAlive(pid)).toBe(false);
};

test
  .skipIf(process.platform !== "linux" && process.platform !== "darwin")
  .each(["immediate Bun child exit", "immediate native child exit", "observed grandchild hard crash"] as const)(
  "worker cleanup stops the detached child after %s and preserves an unrelated peer",
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), "backend-crash-detached-"));
    const entryPath = join(root, "worker.ts");
    const marker = join(root, "agent.pid");
    const launcherMarker = join(root, "launcher.pid");
    let worker: BackendWorker | undefined;
    let peer: Bun.Subprocess | undefined;
    try {
      const observed = mode === "observed grandchild hard crash";
      // The unflagged launcher lets a native grandchild survive its ancestors' deaths unless the
      // supervisor recorded it. A direct Linux child can already receive Bun's parent-death signal.
      const launcher = `
        import { writeFileSync } from "node:fs";
        const agent = Bun.spawn(["/bin/sleep", "8"], { detached: true, stdio: ["ignore", "ignore", "ignore"] });
        writeFileSync(${JSON.stringify(marker)}, String(agent.pid));
        agent.unref();
        setTimeout(() => {}, 8_000);
      `;
      const command =
        mode === "immediate native child exit"
          ? ["/bin/sleep", "8"]
          : [process.execPath, "-e", observed ? launcher : "setTimeout(() => {}, 8_000)"];
      await writeFile(
        entryPath,
        `import { writeFileSync } from "node:fs";
        export default {
          start() {
            const agent = Bun.spawn(${JSON.stringify(command)}, {
              detached: true, stdio: ["ignore", "ignore", "ignore"],
              ${observed ? 'env: { ...process.env, BUN_FEATURE_FLAG_NO_ORPHANS: "0" },' : ""}
            });
            writeFileSync(${JSON.stringify(observed ? launcherMarker : marker)}, String(agent.pid));
            agent.unref();
            ${observed ? 'return { crash() { process.kill(process.pid, "SIGKILL"); } };' : "process.exit(7);"}
          },
        };`,
      );
      worker = await startBackendWorker({
        command: backendWorkerCommand(),
        env: createExtensionProcessEnvironment(),
        entryPath,
      });
      peer = Bun.spawn([process.execPath, "-e", "setTimeout(() => {}, 8_000)"], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
      });
      const { start } = worker.definition as { start: { [HANDLER_MARKER]: string } };
      const call = worker.invoke({
        handlerId: start[HANDLER_MARKER],
        surface: { kind: "object", members: {} },
        context: {},
        args: [],
      });
      let failure: unknown;
      if (observed) {
        const agent = (await call) as { crash: () => Promise<unknown> };
        const pid = await waitForPid(marker);
        expect(isProcessAlive(pid)).toBe(true);
        // Give the live supervisor time to record the agent before killing the leader.
        await Bun.sleep(750);
        failure = await deadline(agent.crash(), "Crash did not settle").catch((error) => error);
      } else {
        failure = await deadline(call, "Exit did not settle").catch((error) => error);
      }
      expect(failure).toMatchObject({
        code: "backend_unavailable",
        message: expect.stringMatching(/backend (disconnected|exited)/),
      });

      await deadline(worker.exited, "Worker cleanup did not settle");
      const pid = Number(await readFile(marker, "utf8"));
      expect(pid).toBeGreaterThan(0);
      expect(isProcessAlive(pid)).toBe(false);
      if (observed) expect(isProcessAlive(await waitForPid(launcherMarker))).toBe(false);
      expect(isProcessAlive(peer.pid)).toBe(true);
    } finally {
      try {
        await worker?.stop().catch(() => {});
        await stopFixtureProcess(launcherMarker);
        await stopFixtureProcess(marker);
      } finally {
        peer?.kill("SIGKILL");
        await peer?.exited;
        await rm(root, { recursive: true, force: true });
      }
    }
  },
  12_000,
);
