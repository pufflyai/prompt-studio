import { resolve } from "node:path";
import type { ProcessHandle, ProcessRunInput, ProcessSpawnInput } from "pstdio-api-contracts/extension-kernel";
import { createProcessHandleProxy, type ProcessOwner, processError } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { watchLease } from "./extension-process-lifetime";
import type { ProcessTarget } from "./extension-targets";
import { resolveProcessEnvironmentCommand } from "./process-command";
import type { ProcessEnvironmentLease } from "./process-environment/permissions";
import { spawnProcessHandle } from "./process-handle";
import { redactProcessOutput } from "./process-output-stream-redaction";

export interface ProcessSpawnOptions {
  owner(lifetime: "call" | "extension"): ProcessOwner | undefined;
  ensureActive(): void;
  /** Undefined runs the child on this device with the cwd it passes. `signal` aborts when the handle is stopped first. */
  resolveTarget?: (workspaceId: string | undefined, signal: AbortSignal) => Promise<ProcessTarget | undefined>;
  prepareEnvironment(
    input: ProcessRunInput,
    active: () => void,
  ): Promise<{ env: Record<string, string | undefined>; lease?: ProcessEnvironmentLease; granted: string[] }>;
  spawner?: typeof Bun.spawn;
}

// An opening remote call can still return a child after cancellation. Reserve its ownership
// before invoking the provider, and free it only once the proxy verifies it has no live tree.
const MAX_REMOTE_PROCESSES_PER_OWNER = 256;
const remoteProcesses = new WeakMap<ProcessOwner, number>();

const reserveRemote = (owner: ProcessOwner) => {
  const count = remoteProcesses.get(owner) ?? 0;
  if (count >= MAX_REMOTE_PROCESSES_PER_OWNER)
    throw processError(
      "process_target_unavailable",
      `This process owner has ${MAX_REMOTE_PROCESSES_PER_OWNER} remote processes awaiting cleanup. Stop an earlier process before starting another.`,
    );
  remoteProcesses.set(owner, count + 1);
  return () => {
    const remaining = remoteProcesses.get(owner)! - 1;
    if (remaining === 0) remoteProcesses.delete(owner);
    else remoteProcesses.set(owner, remaining);
  };
};

const checkInput = (input: ProcessSpawnInput) => {
  if (
    !Array.isArray(input.command) ||
    input.command.length === 0 ||
    input.command.some((part) => typeof part !== "string")
  )
    throw processError("process_command_not_found", "spawn needs a command: a non-empty array of strings.");
  const lifetime = input.lifetime ?? "call";
  if (lifetime !== "call" && lifetime !== "extension")
    throw new Error(`Unknown process lifetime: ${String(lifetime)}. Use "call" or "extension".`);
  return lifetime;
};

type ProcessAdmission = { local?: ProcessHandle; releaseRemote?: () => void };

const spawnLocal = async (
  options: ProcessSpawnOptions,
  input: ProcessSpawnInput,
  root: string | undefined,
  owner: ProcessOwner,
  active: () => void,
  admission: ProcessAdmission,
) => {
  // The selected target's root anchors a relative cwd; a cwd never selects another target.
  const cwd = input.cwd === undefined ? root : resolve(root ?? process.cwd(), input.cwd);
  const { env, lease, granted } = await options.prepareEnvironment({ ...input, cwd }, active);
  let treeExited: Promise<void> | undefined;
  try {
    if (owner.ready) await owner.ready;
    active();
    const resolved = resolveProcessEnvironmentCommand(input.command, env, cwd);
    const start = () => {
      const handle = spawnProcessHandle(
        { argv: resolved.argv, cwd, env, windowsVerbatimArguments: resolved.windowsVerbatimArguments },
        {
          spawner: options.spawner,
          onSpawn: (exited) => {
            treeExited = exited;
          },
        },
      );
      return { value: handle, stop: () => handle.kill("SIGKILL") };
    };
    // Lease admission and registration of its stop callback must be one step.
    const handle = lease ? lease.start(start) : start().value;
    if (lease) watchLease(treeExited ?? handle.exited.then(() => {}), lease);
    // Open the proxy before the Windows launcher acknowledges target startup so kill can stop it.
    const output = redactProcessOutput(handle, granted);
    admission.local = output;
    return output;
  } finally {
    lease?.releaseUnused();
  }
};

const ownerFor = (options: ProcessSpawnOptions, lifetime: "call" | "extension") => {
  const owner = options.owner(lifetime);
  if (owner && !owner.closed) return owner;
  throw processError(
    "process_owner_closed",
    lifetime === "extension"
      ? "Extension lifetime is not available here, or the extension is being stopped."
      : "The call that would own this process has ended.",
  );
};

// After the synchronous start, a child with extension lifetime depends only on its own owner: the
// call that asked for it may return before the target resolves.
const activeCheck =
  (options: ProcessSpawnOptions, lifetime: "call" | "extension", owner: ProcessOwner, signal: AbortSignal) => () => {
    signal.throwIfAborted();
    if (owner.closed)
      throw processError("process_owner_closed", "The owner of this process ended while it was starting.");
    if (lifetime === "call") options.ensureActive();
  };

const openOnTarget = async (
  options: ProcessSpawnOptions,
  input: ProcessSpawnInput,
  owner: ProcessOwner,
  active: () => void,
  signal: AbortSignal,
  admission: ProcessAdmission,
) => {
  if (owner.ready) await owner.ready;
  active();
  const target = options.resolveTarget ? await options.resolveTarget(input.workspaceId, signal) : undefined;
  if (owner.ready) await owner.ready;
  active();
  if (target?.kind !== "remote") return spawnLocal(options, input, target?.root, owner, active, admission);
  if (input.envFromHost?.length)
    throw processError("process_target_unsupported", "envFromHost passes host values to local children only.");
  admission.releaseRemote = reserveRemote(owner);
  return target.spawn({ ...input, lifetime: input.lifetime ?? "call" }, signal);
};

/**
 * `ctx.process.spawn`: picks the owner for the lifetime, resolves the target, then starts the
 * child there. The handle exists at once; every failure on the way settles it as a failed start.
 */
export const createProcessSpawn = (options: ProcessSpawnOptions) => (input: ProcessSpawnInput) => {
  const cancel = new AbortController();
  let owner: ProcessOwner | undefined;
  const admission: ProcessAdmission = {};
  let open: Promise<ProcessHandle>;
  try {
    const lifetime = checkInput(input);
    owner = ownerFor(options, lifetime);
    options.ensureActive();
    open = openOnTarget(
      options,
      input,
      owner,
      activeCheck(options, lifetime, owner, cancel.signal),
      cancel.signal,
      admission,
    );
  } catch (error) {
    open = Promise.reject(error);
  }
  const handle = createProcessHandleProxy(open, {
    cancel,
    admittedLocal: () => admission.local,
    mayOpenAfterAbort: () => admission.releaseRemote !== undefined,
    onLateStopFailure: (error) => {
      apiLogger.warn(
        { err: error, event: "extension.process.late_cleanup_failed" },
        "Could not stop a process that arrived after cancellation",
      );
    },
  });
  void handle.treeExited.then(() => admission.releaseRemote?.());
  // The owner holds the handle before any child exists, so closing it never misses one.
  owner?.adopt(handle);
  return handle;
};
