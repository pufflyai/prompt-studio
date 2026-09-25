import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { discoverRuntime } from "../runtime/runtime-descriptor";

export const stopSmokeProcess = async (child: ChildProcess) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
  try {
    await stopped;
  } finally {
    clearTimeout(force);
  }
};

export const startSmokeHost = async (input: {
  home: string;
  project: string;
  env: NodeJS.ProcessEnv;
  logPath: string;
  signal: AbortSignal;
}) => {
  const compiled = Bun.embeddedFiles.length > 0;
  const args = compiled ? [] : ["--conditions=source", resolve(import.meta.dirname, "../../index.ts")];
  const child = spawn(
    process.execPath,
    [...args, "serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "0"],
    {
      cwd: input.project,
      env: { ...input.env, ...(!compiled ? { PSTDIO_DISABLE_EMBED_MANIFEST: "1" } : {}) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let failure: Error | undefined;
  child.on("error", (error) => {
    failure = error;
  });
  const capture = (data: Buffer) => {
    appendFileSync(input.logPath, data);
    process.stderr.write(data);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  const abort = () => {
    void stopSmokeProcess(child);
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const close = async () => {
    input.signal.removeEventListener("abort", abort);
    await stopSmokeProcess(child);
  };
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      input.signal.throwIfAborted();
      if (failure) throw failure;
      if (child.exitCode !== null) throw new Error(`Host exited with code ${child.exitCode}. See host.log.`);
      const path = join(input.home, "runtime.json");
      const discovered = await discoverRuntime(path, {
        signal: AbortSignal.any([input.signal, AbortSignal.timeout(1000)]),
      }).catch(() => null);
      if (discovered?.state === "healthy") {
        if (discovered.descriptor.pid !== child.pid) throw new Error("Host published an invalid runtime descriptor.");
        return { ...discovered.descriptor, close };
      }
      await sleep(100, undefined, { signal: input.signal });
    }
    throw new Error("Host did not become ready within 30000ms. See host.log.");
  } catch (error) {
    await close();
    throw error;
  }
};
