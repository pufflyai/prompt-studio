import { execFile, execFileSync, spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const nativeWindowId = (property: string) => /window id # (0x[0-9a-f]*[1-9a-f][0-9a-f]*)\b/i.exec(property)?.[1];
const readWindowManager = async (signal: AbortSignal) => {
  const { stdout } = await execute("xprop", ["-root", "_NET_SUPPORTING_WM_CHECK"], { signal });
  const id = nativeWindowId(stdout);
  if (!id) return;
  const owner = await execute("xprop", ["-id", id, "_NET_SUPPORTING_WM_CHECK"], { signal }).catch((error) => {
    if (error.code === 1) return undefined;
    throw error;
  });
  if (owner && nativeWindowId(owner.stdout) === id) return id;
};

const ensureTool = (tool: string, args: string[]) => {
  try {
    execFileSync(tool, args, { stdio: "ignore" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (!process.env.GITHUB_ACTIONS)
      throw new Error("Install Openbox and x11-utils before running source Electron tests on bare Xvfb");
    execFileSync("sudo", ["apt-get", "update"], { stdio: "inherit" });
    execFileSync("sudo", ["apt-get", "install", "-y", "--no-install-recommends", "openbox", "x11-utils"], {
      stdio: "inherit",
    });
  }
};

export default async () => {
  if (process.platform !== "linux") return;
  if (!process.env.DISPLAY) throw new Error("Source Electron tests need an X11 display (use xvfb-run in CI)");

  let manager: ReturnType<typeof spawn> | undefined;
  let spawnError: Error | undefined;
  let closed: Promise<void> | undefined;
  const setup = new AbortController();
  const cancel = () => setup.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const assertAlive = () => {
    if (spawnError) throw spawnError;
    if (manager && (manager.exitCode !== null || manager.signalCode !== null))
      throw new Error(`Native X11 window manager stopped unexpectedly (${manager.exitCode ?? manager.signalCode})`);
  };
  const dispose = async () => {
    if (manager && manager.exitCode === null && manager.signalCode === null) manager.kill();
    await closed;
  };
  try {
    // Source tests run from the candidate while trusted workflows stay on main.
    // A normal Linux desktop already has a manager; only own one on bare Xvfb.
    ensureTool("xprop", ["-version"]);
    if (await readWindowManager(setup.signal)) {
      setup.signal.throwIfAborted();
      return;
    }
    setup.signal.throwIfAborted();
    ensureTool("openbox", ["--version"]);
    setup.signal.throwIfAborted();
    manager = spawn("openbox", ["--sm-disable"], { stdio: "inherit" });
    manager.once("error", (error) => {
      spawnError = error;
    });
    closed = new Promise<void>((resolve) => manager!.once("close", () => resolve()));
    while (true) {
      setup.signal.throwIfAborted();
      assertAlive();
      // xprop exits zero for an absent property; require a real native window.
      if (await readWindowManager(setup.signal)) break;
      await setTimeout(100, undefined, { signal: setup.signal });
    }
    setup.signal.throwIfAborted();
    assertAlive();
    console.log("Native X11 window manager is ready");
    return async () => {
      try {
        assertAlive();
      } finally {
        await dispose();
      }
    };
  } catch (error) {
    await dispose();
    throw error;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
};
