import {
  type CommandContext,
  defineCommand,
  params,
  type ResourceRef,
  type SessionMessage,
} from "@pstdio/sdk/extensions";
import { sessionResource } from "./resource";

type Position = { id: string; position: number };
export interface SessionChanges {
  createdAt: string;
  status: string;
  changePositions?: { input?: Position; reply?: Position };
}

const stamp = (session: SessionChanges, position: number) => ({
  lineage: `conversation-v1/${session.createdAt}`,
  revision: String(position),
});

export const observedSessionChange = (session: SessionChanges, messages: SessionMessage[], approvalId?: string) => {
  const { reply, input } = session.changePositions ?? {};
  if (reply && !messages.some((m) => m.id === reply.id && m.role === "assistant")) return null;
  if (
    input &&
    input.position > (reply?.position ?? 0) &&
    approvalId !== input.id &&
    !messages.some((m) => m.parts.some((part) => part.type === "tool" && part.callId === input.id)) &&
    (session.status === "awaiting_input" || session.status === "in_progress")
  )
    return null;
  return stamp(session, Math.max(reply?.position ?? 0, input?.position ?? 0));
};

// An older host can still open the same conversation without the optional receipt capability.
export const observeRenderedSession = (
  ctx: { resources: object; projectId: string },
  id: string,
  stamp: ReturnType<typeof observedSessionChange>,
) => {
  const owner = ctx.resources as {
    observeChange?: (resource: ResourceRef, position: NonNullable<typeof stamp>) => Promise<string>;
  };
  return stamp && owner?.observeChange
    ? owner.observeChange({ type: "session", extensionId: "pstdio", projectId: ctx.projectId, id }, stamp)
    : null;
};

export const renderedObservation = async (
  ctx: Pick<CommandContext, "resources" | "projectId">,
  id: string,
  session: SessionChanges,
  messages: SessionMessage[],
  approvalId?: string,
) => {
  if (!ctx.resources || !("observeChange" in ctx.resources)) return {};
  return {
    observedChange: await observeRenderedSession(ctx, id, observedSessionChange(session, messages, approvalId)),
  };
};

// Capture the state paired with this frame before another stream callback can replace it.
export const createStreamObservation = (
  ctx: CommandContext,
  id: string,
  write: (receipt: string) => Promise<unknown>,
) => {
  let emitted: string | undefined;
  return (session: SessionChanges | undefined, messages: SessionMessage[] | undefined, approvalId?: string) => {
    if (!session || !messages || !ctx.resources || !("observeChange" in ctx.resources)) return;
    const head = session.changePositions;
    const position = JSON.stringify([session.createdAt, head?.input?.position, head?.reply?.position]);
    if (position === emitted) return;
    return async () => {
      if (position === emitted || ctx.signal.aborted) return;
      const { observedChange } = await renderedObservation(ctx, id, session, messages, approvalId);
      if (observedChange && !ctx.signal.aborted) {
        await write(observedChange);
        emitted = position;
      }
    };
  };
};

export const changeHeads = defineCommand({
  id: "change-heads",
  title: "Read session change positions",
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, { resources }) {
    const ids = (resources ?? [])
      .filter((r) => r.type === "session" && r.extensionId === "pstdio" && r.projectId === ctx.projectId)
      .map((r) => r.id);
    if (!ids.length) return [];
    const query = { ids, limit: 50 };
    const { items } = await ctx.sessions.query(query);
    return items.map((session: (typeof items)[number] & SessionChanges) => ({
      resource: sessionResource(session, ctx.projectId),
      stamp: stamp(
        session,
        Math.max(session.changePositions?.reply?.position ?? 0, session.changePositions?.input?.position ?? 0),
      ),
    }));
  },
});

export const readChange = defineCommand({
  id: "read-change",
  title: "Read observed session content",
  async run(ctx) {
    if (ctx.resource?.type !== "session") throw new Error("Choose a session.");
    const content = await ctx.sessions.getConversation(ctx.resource.id);
    const approvals = ("approvals" in content ? (content.approvals as { id: string }[] | undefined) : undefined) ?? [];
    const observed = observedSessionChange(content.session, content.messages, approvals[0]?.id);
    if (!observed) throw new Error("The displayed conversation is catching up.");
    return { content: { messages: content.messages, approvals }, stamp: observed };
  },
});
