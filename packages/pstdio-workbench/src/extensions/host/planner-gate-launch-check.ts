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

export async function settleCheckedGateLaunch(
  operations: WorkbenchOperations,
  projectId: string,
  ticket: unknown,
  value: unknown,
) {
  const confirmed = confirmedGateLaunch.safeParse(value);
  if (!confirmed.success || typeof ticket !== "string") return;
  const entry = operations.getSnapshot().recovery.find(({ projectId: id, canCheck, draft }) => {
    if (id !== projectId || !canCheck || !draft || typeof draft !== "object") return false;
    const params = draft as Record<string, unknown>;
    return (
      params.commandId === plannerGateLaunch && params.ticket === ticket && params.attemptId === confirmed.data.launchId
    );
  });
  if (entry) await operations.check(entry.id);
}
