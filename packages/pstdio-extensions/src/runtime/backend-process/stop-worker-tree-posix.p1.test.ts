import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessAlive } from "pstdio-paths";
import { stopBackendWorkerTree } from "./stop-worker-tree";

const spawn = (script: string) =>
  Bun.spawn([process.execPath, "-e", script], { detached: true, stdio: ["ignore", "ignore", "ignore"] });

const readPid = async (path: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const pid = Number(
      await Bun.file(path)
        .text()
        .catch(() => ""),
    );
    if (pid > 0) return pid;
    await Bun.sleep(10);
  }
  throw new Error("The fixture process did not start.");
};

test
  .skipIf(process.platform === "win32")
  .each(["spawn in flight", "launcher reparenting", "direct group cleanup"] as const)(
  "watchdog cleanup stops the detached agent after %s",
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), "backend-tree-race-"));
    const gate = join(root, "gate");
    const agentFile = join(root, "agent");
    const launcherFile = join(root, "launcher");
    const reparented = join(root, "reparented");
    const sleep = "setInterval(() => {}, 1000)";
    const startAgent = `const agent = Bun.spawn([process.execPath, "-e", ${JSON.stringify(sleep)}], {
      detached: true, stdio: ["ignore", "ignore", "ignore"],
    });
    await Bun.write(${JSON.stringify(agentFile)}, String(agent.pid));`;
    let script = startAgent + sleep;
    if (mode === "spawn in flight") {
      script = `while (!await Bun.file(${JSON.stringify(gate)}).exists()) await Bun.sleep(5);
           ${startAgent} ${sleep};`;
    }
    if (mode === "launcher reparenting") {
      script = `const launcher = Bun.spawn([process.execPath, "-e", ${JSON.stringify(startAgent + sleep)}], {
             detached: true, stdio: ["ignore", "ignore", "ignore"],
           });
           await Bun.write(${JSON.stringify(launcherFile)}, String(launcher.pid));
           await launcher.exited;
           await Bun.write(${JSON.stringify(reparented)}, String(launcher.pid));
           ${sleep};`;
    }
    const child = spawn(script);
    const peer = spawn(sleep);
    let agentPid: number | undefined;
    let launcher: number | undefined;
    let beforeSuspension: Promise<void> | undefined;
    const nativeKill = process.kill.bind(process);
    let refuseGroup = false;
    const groupSignal = spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (process.platform === "darwin" && signal === "SIGKILL" && pid === -Number(agentPid)) {
        refuseGroup = true;
        throw Object.assign(new Error("Exiting group"), { code: "EPERM" });
      }
      return nativeKill(pid, signal);
    });
    try {
      if (mode === "launcher reparenting") launcher = await readPid(launcherFile);
      if (mode !== "spawn in flight") {
        agentPid = await readPid(agentFile);
        expect(isProcessAlive(agentPid)).toBe(true);
      }
      await stopBackendWorkerTree(
        {
          pid: child.pid,
          get exitCode() {
            return child.exitCode;
          },
          get signalCode() {
            return child.signalCode;
          },
          exited: child.exited,
          kill(signal) {
            if (signal !== "SIGSTOP" || mode === "direct group cleanup") return child.kill(signal);
            beforeSuspension ??= (async () => {
              if (launcher) {
                nativeKill(launcher, "SIGKILL");
                await readPid(reparented);
              } else {
                await Bun.write(gate, "start");
                agentPid = await readPid(agentFile);
              }
              child.kill("SIGSTOP");
            })();
            void beforeSuspension.catch(() => {});
          },
        },
        2_000,
      );
      await beforeSuspension;
      expect(agentPid).toBeGreaterThan(0);
      expect(isProcessAlive(agentPid!)).toBe(false);
      expect(isProcessAlive(peer.pid)).toBe(true);
      if (process.platform === "darwin") expect(refuseGroup).toBe(true);
    } finally {
      groupSignal.mockRestore();
      for (const pid of [agentPid, launcher, child.pid, peer.pid]) {
        if (pid && isProcessAlive(pid)) nativeKill(pid, "SIGKILL");
      }
      await Promise.allSettled([child.exited, peer.exited, beforeSuspension]);
      await rm(root, { recursive: true, force: true });
    }
  },
);

test
  .skipIf(process.platform === "win32")
  .each(["unrelated acknowledgement", "missing acknowledgement", "grace timeout"] as const)(
  "forced cleanup remains bounded after %s",
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), "backend-unverified-group-"));
    const ready = join(root, "ready");
    const term = join(root, "term");
    const anchorFile = join(root, "anchor");
    const timesOut = mode === "grace timeout";
    const sleep = "setInterval(() => {}, 1000)";
    const child = spawn(`
      import { writeFileSync } from "node:fs";
      process.on("SIGTERM", () => writeFileSync(${JSON.stringify(term)}, "TERM"));
      if (${timesOut}) {
        const anchor = Bun.spawn(["/bin/sleep", "5"], { stdio: ["ignore", "ignore", "ignore"] });
        await Bun.write(${JSON.stringify(anchorFile)}, String(anchor.pid));
      }
      await Bun.write(${JSON.stringify(ready)}, String(process.pid));
      ${sleep};
    `);
    const peer = spawn(sleep);
    const withheld = Promise.withResolvers<number | null>();
    let anchor = 0;
    try {
      await readPid(ready);
      if (timesOut) anchor = await readPid(anchorFile);
      const reply = mode === "unrelated acknowledgement" ? peer.pid : anchor;
      const requestAnchor = () => (reply ? Promise.resolve(reply) : withheld.promise);
      await stopBackendWorkerTree(child, 500, requestAnchor);
      expect(await Bun.file(term).exists()).toBe(timesOut);
      if (anchor) expect(isProcessAlive(anchor)).toBe(false);
      expect(isProcessAlive(child.pid)).toBe(false);
      expect(isProcessAlive(peer.pid)).toBe(true);
    } finally {
      withheld.resolve(null);
      if (anchor && isProcessAlive(anchor)) process.kill(anchor, "SIGKILL");
      for (const process of [child, peer]) process.kill("SIGKILL");
      await Promise.all([child.exited, peer.exited]);
      await rm(root, { force: true, recursive: true });
    }
  },
);
