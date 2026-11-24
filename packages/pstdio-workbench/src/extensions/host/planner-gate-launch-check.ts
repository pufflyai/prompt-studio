import { z } from "zod";
import type { WorkbenchOperations } from "../../core/registries/mutations/operations";
import { plannerGateLaunch } from "./workbench-command-operation";

const confirmedGateLaunch = z.object({
  status: z.literal("confirmed"),
  launchId: z.string().min(1),
  session: z.object({ id: z.string().min(1) }),
});

export function checkExactGateLaunch<T>(
  params: Record<string, unknown> | undefined,
  execute: (args: { ticket: string; attemptId: string }, signal: AbortSignal) => Promise<T>,
  unwrap: (result: T) => unknown,
) {
  const { ticket, attemptId } = params ?? {};
  if (typeof ticket !== "string" || typeof attemptId !== "string") return undefined;
  return async (signal: AbortSignal) => {
    const result = await execute({ ticket, attemptId }, signal);
    const confirmed = confirmedGateLaunch.safeParse(unwrap(result));
    return confirmed.success && confirmed.data.launchId === attemptId
      ? { status: "confirmed" as const, result }
      : { status: "unknown" as const };
  };
}

export async function readAndSettleGateLaunch<T>(
  operations: WorkbenchOperations,
  projectId: string,
  ticket: unknown,
  read: () => Promise<T>,
  unwrap: (result: T) => unknown,
) {
  const confirm = operations.captureRecoveryConfirmation();
  const result = await read();
  const proof = confirmedGateLaunch.safeParse(unwrap(result));
  if (!proof.success || typeof ticket !== "string") return result;
  const entry = operations.getSnapshot().recovery.find(({ projectId: id, status, draft }) => {
    if (id !== projectId || status === "rejected" || !draft || typeof draft !== "object") return false;
    const params = draft as Record<string, unknown>;
    return (
      params.commandId === plannerGateLaunch && params.ticket === ticket && params.attemptId === proof.data.launchId
    );
  });
  if (entry) confirm(entry.id);
  return result;
}
