import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { requestRuntimeShutdown } from "../runtime/runtime-client";
import { discoverRuntime, type RuntimeDescriptor, readRuntimeDescriptor } from "../runtime/runtime-descriptor";

export const stopSmokeProcess = async (child: ChildProcess, descriptor?: RuntimeDescriptor | null) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
  try {
    // Windows terminates on SIGTERM without running host cleanup. A published
    // runtime has an authenticated shutdown path that closes storage and its descriptor.
    const result =
      descriptor?.pid === child.pid
        ? await requestRuntimeShutdown(descriptor, true, undefined, AbortSignal.timeout(1000))
        : null;
    if (result?.state !== "accepted" && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
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
  let closing: Promise<void> | undefined;
  const close = () => {
    input.signal.removeEventListener("abort", abort);
    closing ??= stopSmokeProcess(child, readRuntimeDescriptor(join(input.home, "runtime.json")));
    return closing;
  };
  const abort = () => {
    void close();
  };
  input.signal.addEventListener("abort", abort, { once: true });
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
