import { randomUUID } from "node:crypto";
import type { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import {
  discoverRuntime,
  isRuntimePidAlive,
  observeRuntimeShutdown,
  type RuntimeDescriptor,
  readRuntimeDescriptor,
  readRuntimeShutdown,
  requestRuntimeShutdown,
  waitForRuntimeExit,
} from "pstdio/runtime";
import { redactSensitiveText } from "pstdio-logging";
import type { DesktopStartupPhase } from "../lifecycle/lifecycle-machine";
import {
  classifyRuntimeFailure,
  createSidecarLaunchArguments,
  reconcileRuntimeOwnership,
  verifyExternalRuntime,
  waitForDesktopRuntime,
} from "./runtime-controller";
import { resolveRuntimeEnvironment } from "./runtime-environment";
import { spawnRuntimeProcess } from "./runtime-process";
import { observeRuntimeStartup } from "./runtime-startup-progress";

const SIDECAR_TERMINATION_GRACE_MS = 2_000;

export type ManagedRuntime = {
  descriptor: RuntimeDescriptor;
  external: boolean;
};

type RuntimeManagerOptions = {
  descriptorPath: string;
  externalRuntime?: boolean;
  resolveSidecarPath: (signal: AbortSignal) => string | Promise<string>;
  onIntentionalShutdown: () => void;
  onUnexpectedExit: (detail: string) => void;
  onPhase: (phase: DesktopStartupPhase) => void;
};

type RuntimeProcess = {
  pid?: number;
  kill: (signal?: NodeJS.Signals | number) => boolean;
  readOutput: () => string;
  once: EventEmitter["once"];
};

type RuntimeSpawnOptions = {
  env: NodeJS.ProcessEnv;
  outputPath: string;
};

type RuntimeManagerDeps = {
  createInstanceId: () => string;
  discoverRuntime: typeof discoverRuntime;
  existsSync: typeof existsSync;
  isRuntimePidAlive: typeof isRuntimePidAlive;
  observeRuntimeShutdown: typeof observeRuntimeShutdown;
  readRuntimeDescriptor: typeof readRuntimeDescriptor;
  resolveEnvironment: typeof resolveRuntimeEnvironment;
  requestRuntimeShutdown: typeof requestRuntimeShutdown;
  sleep: (milliseconds: number) => Promise<void>;
  spawn: (path: string, args: string[], options: RuntimeSpawnOptions) => RuntimeProcess;
  verifyExternalRuntime: typeof verifyExternalRuntime;
  waitForRuntimeExit: typeof waitForRuntimeExit;
};

const defaultDeps: RuntimeManagerDeps = {
  createInstanceId: randomUUID,
  discoverRuntime,
  existsSync,
  isRuntimePidAlive,
  observeRuntimeShutdown,
  readRuntimeDescriptor,
  resolveEnvironment: resolveRuntimeEnvironment,
  requestRuntimeShutdown,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  spawn: spawnRuntimeProcess,
  verifyExternalRuntime,
  waitForRuntimeExit,
};

const terminateSpawnedRuntime = async (
  child: RuntimeProcess,
  terminated: Promise<void>,
  sleep: RuntimeManagerDeps["sleep"],
) => {
  child.kill("SIGTERM");
  const stoppedGracefully = await Promise.race([
    terminated.then(() => true),
    sleep(SIDECAR_TERMINATION_GRACE_MS).then(() => false),
  ]);
  if (stoppedGracefully) return;

  child.kill("SIGKILL");
  await terminated;
};

export class DesktopRuntimeManager {
  #startupAbort: AbortController | null = null;
  #startupTask: Promise<ManagedRuntime> | null = null;
  #eventAbort: AbortController | null = null;
  #intentional = false;
  #readOutput = () => "";
  // The most recent runtime, kept after it exits so diagnostics can name it and redact its token.
  #lastDescriptor: RuntimeDescriptor | null = null;
  #runtime: ManagedRuntime | null = null;
  #spawnedIdentity: { pid: number; instanceId: string } | null = null;
  readonly #deps: RuntimeManagerDeps;
  readonly #options: RuntimeManagerOptions;

  constructor(options: RuntimeManagerOptions, overrides: Partial<RuntimeManagerDeps> = {}) {
    this.#options = options;
    this.#deps = { ...defaultDeps, ...overrides };
  }

  get runtime() {
    return this.#runtime;
  }

  get processIdentity() {
    const descriptor = this.#runtime?.descriptor;
    return descriptor ? { pid: descriptor.pid, instanceId: descriptor.instanceId } : this.#spawnedIdentity;
  }

  get lastDescriptor() {
    return this.#lastDescriptor;
  }

  async refreshRuntime() {
    if (!this.#runtime) return null;
    if (this.#runtime.external) return this.#runtime;
    const discovery = await this.#deps.discoverRuntime(this.#options.descriptorPath);
    if (discovery.state === "missing") {
      this.#forgetRuntime();
      return null;
    }
    this.#runtime = {
      ...this.#runtime,
      descriptor: reconcileRuntimeOwnership(this.#runtime.descriptor, discovery),
    };
    this.#lastDescriptor = this.#runtime.descriptor;
    return this.#runtime;
  }

  diagnosticsDetail() {
    const token = this.#lastDescriptor?.token;
    return redactSensitiveText(this.#readOutput(), token ? [token] : []);
  }

  start() {
    if (this.#startupTask) return this.#startupTask;
    const startup = new AbortController();
    this.#startupAbort = startup;
    this.#startupTask = this.#start(startup.signal).finally(() => {
      startup.abort();
      this.#startupAbort = null;
      this.#startupTask = null;
    });
    return this.#startupTask;
  }

  async cancelStart() {
    this.#startupAbort?.abort();
    await this.#startupTask?.catch(() => {});
  }

  async #start(signal: AbortSignal) {
    this.#intentional = false;
    this.#eventAbort?.abort();
    this.#options.onPhase("discovery");
    if (this.#options.externalRuntime) {
      const descriptor = this.#deps.readRuntimeDescriptor(this.#options.descriptorPath);
      if (!descriptor) throw new Error("External runtime descriptor is missing or invalid");
      await this.#deps.verifyExternalRuntime(descriptor, signal);
      signal.throwIfAborted();
      return this.#attach(descriptor, true);
    }

    const initialShutdown = readRuntimeShutdown(this.#options.descriptorPath);
    const discover = async (path: string) => {
      signal.throwIfAborted();
      const discovery = await this.#deps.discoverRuntime(path, {
        signal,
        ...(this.#spawnedIdentity ? { expectedRuntime: this.#spawnedIdentity } : {}),
      });
      signal.throwIfAborted();
      return discovery;
    };
    const discovery = await discover(this.#options.descriptorPath);
    if (discovery.state === "healthy") return this.#attach(discovery.descriptor, false, { initialShutdown });
    if (discovery.state === "unsafe") {
      throw new Error(`Runtime ownership is unsafe: ${discovery.reason}`);
    }
    this.#options.onPhase("verification");
    const sidecarPath = await this.#options.resolveSidecarPath(signal);
    signal.throwIfAborted();
    if (!this.#deps.existsSync(sidecarPath)) throw new Error(`Desktop sidecar is missing: ${sidecarPath}`);
    this.#options.onPhase("environment");
    const env = await this.#deps.resolveEnvironment(signal);
    signal.throwIfAborted();
    // Agents inherit this PATH, so they can run the bundled pst even when the person never installed the
    // Terminal command. The Windows installer always adds pst to the user PATH, and Windows has no pst link.
    if (process.platform !== "win32") env.PATH = [dirname(sidecarPath), env.PATH].join(delimiter);

    this.#options.onPhase("spawning");
    this.#readOutput = () => "";
    const instanceId = this.#deps.createInstanceId();
    const child = this.#deps.spawn(sidecarPath, createSidecarLaunchArguments(instanceId), {
      env,
      outputPath: join(dirname(this.#options.descriptorPath), "desktop-runtime.log"),
    });
    this.#readOutput = child.readOutput;
    this.#spawnedIdentity = child.pid === undefined ? null : { pid: child.pid, instanceId };

    let ready: RuntimeDescriptor | null = null;
    let markChildTerminated: () => void = () => {};
    const childTerminated = new Promise<void>((resolve) => {
      markChildTerminated = resolve;
    });
    const childExit = new Promise<never>((_resolve, reject) => {
      child.once("exit", (code, signal) => {
        this.#spawnedIdentity = null;
        markChildTerminated();
        const detail =
          child.readOutput() || `Runtime exited with ${code === null ? `signal ${signal}` : `code ${code}`}`;
        if (!ready) reject(new Error(detail));
        // A clean owned-process exit can arrive before its HTTP shutdown event.
        else if (code === 0 || this.#wasShutdown(ready, initialShutdown)) this.#handleIntentionalShutdown();
        else if (!this.#intentional) {
          this.#forgetRuntime();
          this.#options.onUnexpectedExit(detail);
        }
      });
      child.once("close", markChildTerminated);
      child.once("error", reject);
    });

    this.#options.onPhase("readiness");
    const stopProgress = observeRuntimeStartup(child.readOutput, this.#options.onPhase);
    try {
      const descriptor = await Promise.race([
        waitForDesktopRuntime(this.#options.descriptorPath, instanceId, {
          discover,
          signal,
          sleep: this.#deps.sleep,
        }),
        childExit,
      ]);
      signal.throwIfAborted();
      ready = descriptor;
      return this.#attach(descriptor, false);
    } catch (error) {
      await terminateSpawnedRuntime(child, childTerminated, this.#deps.sleep);
      const detail = child.readOutput() || (error instanceof Error ? error.message : String(error));
      const failure = classifyRuntimeFailure(detail);
      throw new Error(`${failure.code}: ${failure.message}`);
    } finally {
      stopProgress();
    }
  }

  requestShutdown(force: boolean) {
    if (!this.#runtime) return Promise.resolve({ state: "failed" as const });
    return this.#deps.requestRuntimeShutdown(this.#runtime.descriptor, force).then((result) => {
      if (result.state === "accepted") this.#intentional = true;
      return result;
    });
  }

  async waitForExit() {
    if (!this.#runtime) return;
    await this.#deps.waitForRuntimeExit(this.#options.descriptorPath, this.#runtime.descriptor, {
      sleep: this.#deps.sleep,
    });
  }

  async detach() {
    this.#intentional = true;
    this.#eventAbort?.abort();
    await this.cancelStart();
  }

  // A runtime that is gone has nothing left to shut down, so quitting must not wait for it.
  #forgetRuntime() {
    this.#eventAbort?.abort();
    this.#runtime = null;
    this.#spawnedIdentity = null;
  }

  #handleIntentionalShutdown() {
    if (this.#intentional) return;
    this.#intentional = true;
    this.#eventAbort?.abort();
    this.#options.onIntentionalShutdown();
  }

  #wasShutdown(descriptor: RuntimeDescriptor, initialShutdown: ReturnType<typeof readRuntimeShutdown>) {
    const shutdown = readRuntimeShutdown(this.#options.descriptorPath);
    // A later stop of this home also applies to an old disconnected desktop, even if
    // a replacement backend has already overwritten the previous shutdown receipt.
    return (
      shutdown !== null &&
      ((shutdown.pid === descriptor.pid && shutdown.instanceId === descriptor.instanceId) ||
        shutdown.pid !== initialShutdown?.pid ||
        shutdown.instanceId !== initialShutdown?.instanceId)
    );
  }

  #attach(
    descriptor: RuntimeDescriptor,
    external: boolean,
    attachment?: { initialShutdown: ReturnType<typeof readRuntimeShutdown> },
  ) {
    this.#runtime = { descriptor, external };
    this.#lastDescriptor = descriptor;
    this.#eventAbort = new AbortController();
    const signal = this.#eventAbort.signal;
    const disconnected = () => {
      // Spawned children have an exit event, including their clean-exit status. An attached
      // backend needs a PID check: a broken connection alone must never replace a live owner.
      if (external || !attachment || signal.aborted || this.#intentional) return;
      // Read intent after checking the process: shutdown can be announced just before it exits.
      const alive = this.#deps.isRuntimePidAlive(descriptor.pid);
      if (this.#wasShutdown(descriptor, attachment.initialShutdown)) {
        this.#handleIntentionalShutdown();
        return;
      }
      if (alive) return;
      this.#forgetRuntime();
      this.#options.onUnexpectedExit("The attached backend process exited unexpectedly.");
    };
    void this.#deps
      .observeRuntimeShutdown(
        descriptor,
        () => {
          if (!signal.aborted) this.#handleIntentionalShutdown();
        },
        fetch,
        signal,
        disconnected,
      )
      .catch(() => {});
    return this.#runtime;
  }
}
