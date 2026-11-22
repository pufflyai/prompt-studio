import { AsyncLocalStorage } from "node:async_hooks";
import type { CommandOutcome } from "@pstdio/sdk/extensions";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";

/**
 * Commands of one extension share this allowance across every project, so opening more projects
 * or callers cannot multiply it. A command's nested commands of the same extension share its slot;
 * any other caller, including a hook, needs its own. A slot is released when the command settles or is cancelled.
 */
export const MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION = 256;
const RETRY_AFTER_MS = 1000;

const running = new Map<string, number>();
// The extensions whose slot the current command holds. Being extension code is not proof of a slot.
const held = new AsyncLocalStorage<ReadonlySet<string>>();

export const holdsAdmission = (extensionId: string) => held.getStore()?.has(extensionId) === true;

export const withAdmission = <T>(extensionId: string, run: () => T) =>
  held.run(new Set([...(held.getStore() ?? []), extensionId]), run);

export const admitInvocation = (extensionId: string) => {
  const count = running.get(extensionId) ?? 0;
  if (count >= MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION) return;
  running.set(extensionId, count + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (running.get(extensionId) ?? 1) - 1;
    if (remaining === 0) running.delete(extensionId);
    else running.set(extensionId, remaining);
  };
};

/** Rejected before the handler starts, so the caller can retry without any partial write. */
export const overloadedOutcome = (extensionId: string): CommandOutcome => {
  const reason = `${extensionId} is already running ${MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION} commands. Retry after some of them finish.`;
  return {
    ok: false,
    status: "rejected",
    code: "extension_overloaded",
    reason,
    diagnostics: [
      {
        code: "extension_overloaded",
        message: reason,
        severity: "warning",
        extensionId,
        metadata: { retryAfterMs: RETRY_AFTER_MS },
      },
    ],
  };
};

/**
 * Runs extension handler code as that extension's work. Only the handler call is attributed, so
 * host work around it, such as environment setup or a shared catalog load, keeps core priority.
 */
export const asExtension = <T>(
  extensionId: string,
  name: string,
  projectId: string | undefined,
  run: () => T,
  kind: "command" | "event" = "command",
) => withRuntimeOperationOrigin({ kind, name, projectId, extensionId }, run);
