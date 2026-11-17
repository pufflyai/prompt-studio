import {
  defineCommand,
  defineHook,
  type ExtensionContextBase,
  l10n,
  params,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { readQuotaAvailability } from "./quota-availability";

export interface QuotaRestartInput {
  sessionId: string;
  harnessId: string;
  startedAt?: string;
  endedAt: string;
  notBefore: string;
}
type Session = NonNullable<Awaited<ReturnType<ExtensionContextBase["sessions"]["get"]>>>;
const stoppedByFailure = (session: Session | null): session is Session =>
  Boolean(
    session &&
      !session.archived &&
      session.status === "failed" &&
      (!session.lastExit || ["failed", "unknown"].includes(session.lastExit.cause)),
  );
const localExecution = async (ctx: ExtensionContextBase, id: string) => {
  const execution = await ctx.sessions.getExecutionState(id);
  return execution.kind === "local" && execution.available;
};
const hasQuotaFailure = async (ctx: ExtensionContextBase, id: string) => {
  const { messages } = await ctx.sessions.getConversation(id);
  let lastUser = -1;
  messages.forEach((message, index) => {
    if (message.role === "user") lastUser = index;
  });
  // Only provider error parts from the failed turn identify a limit stop.
  return messages
    .slice(lastUser + 1)
    .some((message) =>
      message.parts.some(
        (part) =>
          part.type === "error" &&
          /(?:rate|usage)[ -]?limit|quota|limit.*(?:reached|exceeded)|(?:reached|exceeded|hit).*limit|too many requests|insufficient.*(?:quota|credit)/i.test(
            part.message ?? "",
          ),
      ),
    );
};
const enqueueRestart = (ctx: ExtensionContextBase, session: Session, resetsAt: string) => {
  const notBefore = new Date(Date.parse(resetsAt) + 15_000).toISOString();
  const input: QuotaRestartInput = {
    sessionId: session.id,
    harnessId: session.agent!,
    ...(session.lastRequestStarted ? { startedAt: session.lastRequestStarted } : {}),
    endedAt: session.lastRequestEnded!,
    notBefore,
  };
  const job = {
    command: quotaRestart.ref,
    input: { params: { ...input } },
    key: `quota-restart:${session.id}:${input.endedAt}:${resetsAt}`,
    notBefore,
  };
  return ctx.automation.enqueue(job);
};
export const scheduleQuotaRestart = async (ctx: ExtensionContextBase, sessionId: string) => {
  const session = await ctx.sessions.get(sessionId);
  if (
    !stoppedByFailure(session) ||
    !session.agent ||
    !session.lastRequestEnded ||
    !(await localExecution(ctx, session.id)) ||
    !(await hasQuotaFailure(ctx, session.id))
  )
    return false;
  const quota = await readQuotaAvailability(ctx, session.agent);
  if (!quota.restartAfterQuotaReset || !quota.limited || !quota.resetsAt) return false;
  await enqueueRestart(ctx, session, quota.resetsAt);
  return true;
};
export const restartAfterQuotaReset = async (ctx: ExtensionContextBase, input: QuotaRestartInput) => {
  const due = Date.parse(input.notBefore);
  if (!Number.isFinite(due) || Date.now() < due) return { restarted: false };
  const session = await ctx.sessions.get(input.sessionId);
  if (
    !stoppedByFailure(session) ||
    session.agent !== input.harnessId ||
    session.lastRequestStarted !== (input.startedAt ?? null) ||
    session.lastRequestEnded !== input.endedAt ||
    !(await localExecution(ctx, session.id)) ||
    !(await hasQuotaFailure(ctx, session.id))
  )
    return { restarted: false };
  const quota = await readQuotaAvailability(ctx, input.harnessId);
  if (!quota.known || !quota.restartAfterQuotaReset) return { restarted: false };
  if (quota.limited) {
    if (quota.resetsAt) await enqueueRestart(ctx, session, quota.resetsAt);
    return { restarted: false };
  }
  await ctx.sessions.followup({
    sessionId: session.id,
    expectedRun: { status: "failed", startedAt: input.startedAt ?? null, endedAt: input.endedAt },
    prompt:
      "Continue the unfinished work in this conversation. The quota window that stopped the previous turn has reset. Read the current state before continuing.",
  });
  return { restarted: true };
};
export const quotaRestart = defineCommand({
  id: "restart-after-quota-reset",
  title: l10n("quota.restart.title", "Restart after quota reset"),
  automation: true,
  params: {
    sessionId: params.text({ required: true }),
    harnessId: params.text({ required: true }),
    startedAt: params.text(),
    endedAt: params.text({ required: true }),
    notBefore: params.text({ required: true }),
  },
  run: restartAfterQuotaReset,
});
export const quotaRestartHook = defineHook({
  id: "quota-restart",
  event: sessionEvents.failed,
  run: async (ctx, { sessionId }) => {
    await scheduleQuotaRestart(ctx, sessionId);
  },
});
