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
  changePositions?: { input?: Position; reply?: Position & { textDigest: string } };
}

const stamp = (session: SessionChanges, position: number) => ({
  lineage: `conversation-v1/${session.createdAt}`,
  revision: String(position),
});

export const observedSessionChange = async (
  session: SessionChanges,
  messages: SessionMessage[],
  approvalIds?: string | readonly string[],
) => {
  const { reply, input } = session.changePositions ?? {};
  if (reply) {
    const rendered = messages.find((m) => m.id === reply.id && m.role === "assistant");
    if (!rendered) return null;
    // A stream may already contain the assistant's ID while the last text patch is still in flight.
    const texts = rendered.parts.filter((part) => part.type === "text").map((part) => part.text);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(texts)));
    if (Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") !== reply.textDigest)
      return null;
  }
  if (
    input &&
    input.position > (reply?.position ?? 0) &&
    !(typeof approvalIds === "string" ? approvalIds === input.id : approvalIds?.includes(input.id)) &&
    !messages.some((m) => m.parts.some((part) => part.type === "tool" && part.callId === input.id))
  )
    return null;
  return stamp(session, Math.max(reply?.position ?? 0, input?.position ?? 0));
};

// An older host can still open the same conversation without the optional receipt capability.
export const observeRenderedSession = (
  ctx: { resources: object; projectId: string },
  id: string,
  stamp: Awaited<ReturnType<typeof observedSessionChange>>,
) => {
  const owner = ctx.resources as {
    observeChange?: (resource: ResourceRef, position: NonNullable<typeof stamp>) => Promise<string>;
  };
  return stamp && owner?.observeChange
    ? owner.observeChange({ type: "session", extensionId: "pstdio", projectId: ctx.projectId, id }, stamp)
    : null;
};

const historicalWitness = (messages: SessionMessage[]) =>
  messages
    .filter(
      (message) =>
        ["assistant", "user"].includes(message.role) &&
        message.parts.some((part) => {
          if (part.type === "text") return Boolean(part.text.trim());
          if (part.type === "tool")
            return (
              part.tool.toLowerCase() === "question" ||
              ["completed", "failed", "denied", "error"].includes(part.status ?? part.state?.status ?? "")
            );
          return part.type === "file" || part.type === "error";
        }),
    )
    .at(-1);

export const renderedObservation = async (
  ctx: Pick<CommandContext, "resources" | "projectId">,
  id: string,
  session: SessionChanges,
  messages: SessionMessage[],
  approvalId?: string,
) => {
  if (!ctx.resources || !("observeChange" in ctx.resources)) return {};
  const { reply, input } = session.changePositions ?? {};
  const latestInput = input && input.position > (reply?.position ?? 0) ? input : undefined;
  const inputMessage =
    latestInput &&
    messages.find((message) => message.parts.some((part) => part.type === "tool" && part.callId === latestInput.id));
  const fallback = historicalWitness(messages);
  const targetId = inputMessage?.id ?? reply?.id ?? fallback?.id;
  const questionPart = inputMessage?.parts.find(
    (part) => part.type === "tool" && part.callId === latestInput?.id && part.tool.toLowerCase() === "question",
  );
  let questionId: string | null = null;
  if (questionPart?.type === "tool") questionId = questionPart.callId ?? null;
  if (latestInput && latestInput.id === approvalId) questionId = `approval:${approvalId}`;
  return {
    observedChangeMessageIds: targetId ? [targetId] : [],
    observedChangeQuestionId: questionId,
    observedChange: await observeRenderedSession(ctx, id, await observedSessionChange(session, messages, approvalId)),
  };
};

// Capture the state paired with this frame before another stream callback can replace it.
export const createStreamObservation = (
  ctx: CommandContext,
  id: string,
  write: (observation: Awaited<ReturnType<typeof renderedObservation>>) => Promise<unknown>,
) => {
  let emitted: string | undefined;
  return (session: SessionChanges | undefined, messages: SessionMessage[] | undefined, approvalId?: string) => {
    if (!session || !messages || !ctx.resources || !("observeChange" in ctx.resources)) return;
    const head = session.changePositions;
    const position = JSON.stringify([session.createdAt, head?.input?.position, head?.reply?.position]);
    if (position === emitted) return;
    return async () => {
      if (position === emitted || ctx.signal.aborted) return;
      const observation = await renderedObservation(ctx, id, session, messages, approvalId);
      if (observation.observedChange && !ctx.signal.aborted) {
        await write(observation);
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
    const query = { ids, limit: 50, includeArchived: true };
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
    const latest = await observedSessionChange(
      content.session,
      content.messages,
      approvals.map((approval) => approval.id),
    );
    // An expired request may have left the conversation. Return the older content
    // that is actually proven, preserving the newer unseen head instead of making
    // terminal history unreadable through this explicit read operation.
    const observed =
      latest ??
      (await observedSessionChange(
        { ...content.session, changePositions: { reply: content.session.changePositions?.reply } },
        content.messages,
      ));
    if (!observed) throw new Error("The displayed conversation is catching up.");
    return { content: { messages: content.messages, approvals }, stamp: observed };
  },
});
