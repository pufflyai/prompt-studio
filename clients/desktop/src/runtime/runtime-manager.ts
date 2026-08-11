import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import {
  discoverRuntime,
  observeRuntimeShutdown,
  type RuntimeDescriptor,
  readRuntimeDescriptor,
  requestRuntimeShutdown,
  waitForRuntimeExit,
} from "pstdio/runtime";
import { redactSensitiveText } from "pstdio-logging";
import {
  classifyRuntimeFailure,
  createSidecarLaunchArguments,
  reconcileRuntimeOwnership,
  verifyExternalRuntime,
  waitForDesktopRuntime,
} from "./runtime-controller";

const OUTPUT_LIMIT = 64 * 1024;
const SIDECAR_TERMINATION_GRACE_MS = 2_000;

export type ManagedRuntime = {
  descriptor: RuntimeDescriptor;
  external: boolean;
};

type RuntimeManagerOptions = {
  descriptorPath: string;
  externalRuntime?: boolean;
  resolveSidecarPath: () => string;
  onIntentionalShutdown: () => void;
  onUnexpectedExit: (detail: string) => void;
  onPhase: (phase: "discovery" | "spawning" | "readiness") => void;
};

type RuntimeProcess = {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  stdout: { on: (event: "data", listener: (chunk: unknown) => void) => unknown };
  stderr: { on: (event: "data", listener: (chunk: unknown) => void) => unknown };
  once: EventEmitter["once"];
};

type RuntimeSpawnOptions = {
  env: NodeJS.ProcessEnv;
  stdio: ["ignore", "pipe", "pipe"];
  windowsHide: boolean;
};

type RuntimeManagerDeps = {
  createInstanceId: () => string;
  discoverRuntime: typeof discoverRuntime;
  existsSync: typeof existsSync;
  observeRuntimeShutdown: typeof observeRuntimeShutdown;
  readRuntimeDescriptor: typeof readRuntimeDescriptor;
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
  observeRuntimeShutdown,
  readRuntimeDescriptor,
  requestRuntimeShutdown,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  spawn: (path, args, options) => spawn(path, args, options),
  verifyExternalRuntime,
  waitForRuntimeExit,
};

const appendBounded = (current: string, chunk: unknown) => `${current}${String(chunk)}`.slice(-OUTPUT_LIMIT);

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
  #eventAbort: AbortController | null = null;
  #intentional = false;
  #output = "";
  #runtime: ManagedRuntime | null = null;
  readonly #deps: RuntimeManagerDeps;
  readonly #options: RuntimeManagerOptions;

  constructor(options: RuntimeManagerOptions, overrides: Partial<RuntimeManagerDeps> = {}) {
    this.#options = options;
    this.#deps = { ...defaultDeps, ...overrides };
  }

  get runtime() {
    return this.#runtime;
  }

  async refreshRuntime() {
    if (!this.#runtime) return null;
    if (this.#runtime.external) return this.#runtime;
    const discovery = await this.#deps.discoverRuntime(this.#options.descriptorPath);
    this.#runtime = {
      ...this.#runtime,
      descriptor: reconcileRuntimeOwnership(this.#runtime.descriptor, discovery),
    };
    return this.#runtime;
  }

  diagnosticsDetail() {
    const token = this.#runtime?.descriptor.token;
    return redactSensitiveText(this.#output, token ? [token] : []);
  }

  async start() {
    this.#intentional = false;
    this.#eventAbort?.abort();
    this.#options.onPhase("discovery");
    if (this.#options.externalRuntime) {
      const descriptor = this.#deps.readRuntimeDescriptor(this.#options.descriptorPath);
      if (!descriptor) throw new Error("External runtime descriptor is missing or invalid");
      await this.#deps.verifyExternalRuntime(descriptor);
      return this.#attach(descriptor, true);
    }

    const discovery = await this.#deps.discoverRuntime(this.#options.descriptorPath);
    if (discovery.state === "healthy") return this.#attach(discovery.descriptor, false);
    if (discovery.state === "unsafe") {
      throw new Error(`Runtime ownership is unsafe: ${discovery.reason}`);
    }
    const sidecarPath = this.#options.resolveSidecarPath();
    if (!this.#deps.existsSync(sidecarPath)) throw new Error(`Desktop sidecar is missing: ${sidecarPath}`);

    this.#options.onPhase("spawning");
    this.#output = "";
    const instanceId = this.#deps.createInstanceId();
    const child = this.#deps.spawn(sidecarPath, createSidecarLaunchArguments(instanceId), {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.on("data", (chunk) => {
      this.#output = appendBounded(this.#output, chunk);
    });
    child.stderr.on("data", (chunk) => {
      this.#output = appendBounded(this.#output, chunk);
    });

    let ready = false;
    let markChildTerminated: () => void = () => {};
    const childTerminated = new Promise<void>((resolve) => {
      markChildTerminated = resolve;
    });
    const childExit = new Promise<never>((_resolve, reject) => {
      child.once("exit", (code, signal) => {
        markChildTerminated();
        const detail = this.#output || `Runtime exited with ${code === null ? `signal ${signal}` : `code ${code}`}`;
        if (!ready) reject(new Error(detail));
        else if (!this.#intentional) this.#options.onUnexpectedExit(detail);
      });
      child.once("close", markChildTerminated);
      child.once("error", reject);
    });

    this.#options.onPhase("readiness");
    try {
      const descriptor = await Promise.race([
        waitForDesktopRuntime(this.#options.descriptorPath, instanceId, {
          discover: this.#deps.discoverRuntime,
          now: Date.now,
          sleep: this.#deps.sleep,
        }),
        childExit,
      ]);
      ready = true;
      return this.#attach(descriptor, false);
    } catch (error) {
      await terminateSpawnedRuntime(child, childTerminated, this.#deps.sleep);
      const failure = classifyRuntimeFailure(error instanceof Error ? error.message : String(error));
      throw new Error(`${failure.code}: ${failure.message}`);
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

  detach() {
    this.#intentional = true;
    this.#eventAbort?.abort();
  }

  #attach(descriptor: RuntimeDescriptor, external: boolean) {
    this.#runtime = { descriptor, external };
    this.#eventAbort = new AbortController();
    void this.#deps
      .observeRuntimeShutdown(
        descriptor,
        () => {
          this.#intentional = true;
          this.#options.onIntentionalShutdown();
        },
        fetch,
        this.#eventAbort.signal,
      )
      .catch(() => {});
    return this.#runtime;
  }
}
