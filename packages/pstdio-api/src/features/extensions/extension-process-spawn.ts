import { resolve } from "node:path";
import type { ProcessHandle, ProcessRunInput, ProcessSpawnInput } from "pstdio-api-contracts/extension-kernel";
import { createProcessHandleProxy, type ProcessOwner, processError } from "pstdio-extensions";
import type { ProcessTarget } from "./extension-targets";
import { resolveProcessEnvironmentCommand } from "./process-command";
import type { ProcessEnvironmentLease } from "./process-environment/permissions";
import { spawnProcessHandle } from "./process-handle";
import { redactProcessOutput } from "./process-output-redaction";

export interface ProcessSpawnOptions {
  owner(lifetime: "call" | "extension"): ProcessOwner | undefined;
  ensureActive(): void;
  /** Undefined runs the child on this device with the cwd it passes. */
  resolveTarget?: (workspaceId?: string) => Promise<ProcessTarget | undefined>;
  prepareEnvironment(
    input: ProcessRunInput,
  ): Promise<{ env: Record<string, string | undefined>; lease?: ProcessEnvironmentLease; granted: string[] }>;
  spawner?: typeof Bun.spawn;
}

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

const spawnLocal = async (options: ProcessSpawnOptions, input: ProcessSpawnInput, root: string | undefined) => {
  // The selected target's root anchors a relative cwd; a cwd never selects another target.
  const cwd = input.cwd === undefined ? root : resolve(root ?? process.cwd(), input.cwd);
  const { env, lease, granted } = await options.prepareEnvironment({ ...input, cwd });
  let handle: ProcessHandle;
  try {
    options.ensureActive();
    const resolved = resolveProcessEnvironmentCommand(input.command, env, cwd);
    handle = spawnProcessHandle(
      { argv: resolved.argv, cwd, env, windowsVerbatimArguments: resolved.windowsVerbatimArguments },
      { spawner: options.spawner },
    );
  } catch (error) {
    lease?.release();
    throw error;
  }
  if (lease) {
    // A revoked grant stops the child before the revocation takes effect.
    lease.attach(() => handle.kill("SIGKILL"));
    void handle.exited.finally(lease.release);
  }
  await handle.started;
  return redactProcessOutput(handle, granted);
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

const openOnTarget = async (options: ProcessSpawnOptions, input: ProcessSpawnInput, owner: ProcessOwner) => {
  options.ensureActive();
  const target = options.resolveTarget ? await options.resolveTarget(input.workspaceId) : undefined;
  if (owner.closed)
    throw processError("process_owner_closed", "The owner of this process ended while it was starting.");
  options.ensureActive();
  if (target?.kind !== "remote") return spawnLocal(options, input, target?.root);
  if (input.envFromHost?.length)
    throw processError("process_target_unsupported", "envFromHost passes host values to local children only.");
  return target.spawn({ ...input, lifetime: input.lifetime ?? "call" });
};

/**
 * `ctx.process.spawn`: picks the owner for the lifetime, resolves the target, then starts the
 * child there. The handle exists at once; every failure on the way settles it as a failed start.
 */
export const createProcessSpawn =
  (options: ProcessSpawnOptions) =>
  (input: ProcessSpawnInput): ProcessHandle => {
    let owner: ProcessOwner | undefined;
    let open: Promise<ProcessHandle>;
    try {
      owner = ownerFor(options, checkInput(input));
      open = openOnTarget(options, input, owner);
    } catch (error) {
      open = Promise.reject(error);
    }
    const handle = createProcessHandleProxy(open);
    // The owner holds the handle before any child exists, so closing it never misses one.
    owner?.adopt(handle);
    return handle;
  };
