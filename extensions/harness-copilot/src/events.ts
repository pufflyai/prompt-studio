import type { SessionEvent } from "@github/copilot-sdk";
import type { ReasoningPart, SessionMessage, SessionMessagePart, ToolPart } from "@pstdio/sdk/extensions";

type EventOf<T extends SessionEvent["type"]> = Extract<SessionEvent, { type: T }>;
type ToolCall = { toolCallId: string; name: string; arguments?: unknown };

/**
 * Rebuilds conversation messages from Copilot's session event log. Live turns and saved history
 * both go through here, so a message keeps the same id while it streams and after it settles.
 */
class Conversation {
  readonly messages: SessionMessage[] = [];
  private readonly tools = new Map<string, ToolPart>();
  private readonly drafts = new Map<string, SessionMessage>();
  // Reasoning already placed in a message: its later events update that part instead of repeating it.
  private readonly placed = new Map<string, ReasoningPart>();
  private reasoning: { id: string; text: string } | undefined;
  private assistant: SessionMessage | undefined;
  // Copilot reports a model call's usage just before the message that call produced.
  private usage: SessionMessagePart[] = [];
  /** Position in the log of the event that started each message. */
  readonly starts = new Map<string, number>();
  private position = -1;

  constructor(private readonly offset: number) {}

  apply(event: SessionEvent) {
    this.position++;
    // Subagent traffic belongs to its parent tool call; the parent's result already summarizes it.
    if ("parentToolCallId" in event.data && event.data.parentToolCallId) return;
    if (event.type === "user.message") this.user(event);
    else if (event.type === "assistant.reasoning_delta")
      this.think(event.data.reasoningId, event.data.deltaContent, true);
    else if (event.type === "assistant.reasoning") this.think(event.data.reasoningId, event.data.content, false);
    else if (event.type === "assistant.message_delta") this.stream(event);
    else if (event.type === "assistant.message") this.reply(event);
    else if (event.type === "tool.execution_start")
      this.addTool(this.current(event), {
        toolCallId: event.data.toolCallId,
        name: event.data.toolName,
        arguments: event.data.arguments,
      });
    else if (event.type === "tool.execution_complete") this.completeTool(event);
    else if (event.type === "permission.completed") this.denyTool(event);
    else if (event.type === "assistant.usage") this.usage.push(usagePart(event));
    else if (event.type === "session.error")
      this.current(event).parts.push(...this.takeUsage(), {
        type: "error",
        errorType: "other",
        message: event.data.message,
      });
  }

  /** Tools still running when the turn ended were interrupted by an abort, crash, or restart. */
  settle() {
    for (const tool of this.tools.values()) if (tool.status === "running") tool.status = "failed";
    this.assistant?.parts.push(...this.takeUsage());
  }

  private takeUsage() {
    const parts = this.usage;
    this.usage = [];
    return parts;
  }

  private push(message: Omit<SessionMessage, "index">) {
    const indexed = { ...message, index: this.offset + this.messages.length } satisfies SessionMessage;
    this.messages.push(indexed);
    this.starts.set(indexed.id, this.position);
    return indexed;
  }

  private current(event: SessionEvent) {
    this.assistant ??= this.push({
      id: `copilot-${event.id}`,
      role: "assistant",
      createdAt: Date.parse(event.timestamp),
      parts: [],
    });
    return this.assistant;
  }

  private user(event: EventOf<"user.message">) {
    this.assistant = undefined;
    this.push({
      // Steered input carries the host's delivery id as its turn id, so recovery can match it.
      id: event.data.clientTurnId ?? `copilot-${event.id}`,
      role: "user",
      createdAt: Date.parse(event.timestamp),
      parts: [{ type: "text", text: event.data.content }],
    });
  }

  private think(id: string, text: string, delta: boolean) {
    const target = this.placed.get(id) ?? (this.reasoning?.id === id ? this.reasoning : undefined);
    if (target) target.text = delta ? target.text + text : text;
    else this.reasoning = { id, text };
  }

  private takeReasoning(): SessionMessagePart[] {
    const pending = this.reasoning;
    this.reasoning = undefined;
    if (!pending?.text) return [];
    const part: ReasoningPart = { type: "reasoning", text: pending.text };
    this.placed.set(pending.id, part);
    return [part];
  }

  private stream(event: EventOf<"assistant.message_delta">) {
    let draft = this.drafts.get(event.data.messageId);
    if (!draft) {
      draft = this.push({
        id: `copilot-${event.data.messageId}`,
        role: "assistant",
        createdAt: Date.parse(event.timestamp),
        parts: [...this.takeReasoning(), { type: "text", text: "" }],
      });
      this.drafts.set(event.data.messageId, draft);
      this.assistant = draft;
    }
    const text = draft.parts.findLast((part) => part.type === "text");
    if (text?.type === "text") text.text += event.data.deltaContent;
  }

  private reply(event: EventOf<"assistant.message">) {
    const draft = this.drafts.get(event.data.messageId);
    this.drafts.delete(event.data.messageId);
    const parts: SessionMessagePart[] = [
      ...(draft?.parts.filter((part) => part.type === "reasoning") ?? []),
      ...this.takeReasoning(),
    ];
    if (event.data.content) parts.push({ type: "text", text: event.data.content });
    const message = {
      id: `copilot-${event.data.messageId}`,
      role: "assistant" as const,
      createdAt: Date.parse(event.timestamp),
      modelId: event.data.model,
      parts,
    };
    this.assistant = draft ? Object.assign(draft, message) : this.push(message);
    for (const call of event.data.toolRequests ?? []) this.addTool(this.assistant, call);
    this.assistant.parts.push(...this.takeUsage());
  }

  private addTool(target: SessionMessage, call: ToolCall) {
    if (this.tools.has(call.toolCallId)) return;
    const part: ToolPart = {
      type: "tool",
      tool: call.name,
      callId: call.toolCallId,
      status: "running",
      state: { input: call.arguments },
    };
    this.tools.set(call.toolCallId, part);
    target.parts.push(part);
  }

  private completeTool(event: EventOf<"tool.execution_complete">) {
    const tool = this.tools.get(event.data.toolCallId);
    if (!tool) return;
    tool.status = event.data.success ? "completed" : "failed";
    tool.state = {
      ...tool.state,
      output: event.data.result?.content,
      ...(event.data.error ? { errorText: event.data.error.message } : {}),
    };
  }

  private denyTool(event: EventOf<"permission.completed">) {
    const tool = event.data.toolCallId ? this.tools.get(event.data.toolCallId) : undefined;
    if (tool && event.data.result.kind.startsWith("denied")) tool.status = "denied";
  }
}

const usagePart = (event: EventOf<"assistant.usage">): SessionMessagePart => ({
  type: "token_usage",
  inputTokens: event.data.inputTokens ?? 0,
  outputTokens: event.data.outputTokens ?? 0,
  cacheReadTokens: event.data.cacheReadTokens,
  cacheWriteTokens: event.data.cacheWriteTokens,
});

const SETTLED = new Set(["session.idle", "session.shutdown", "abort"]);

const replay = (events: readonly SessionEvent[], offset: number) => {
  const conversation = new Conversation(offset);
  for (const event of events) conversation.apply(event);
  const last = events.findLast((event) => !event.ephemeral || event.type === "session.idle");
  if (last && SETTLED.has(last.type)) conversation.settle();
  return conversation;
};

export const normalizeCopilotEvents = (events: readonly SessionEvent[], offset = 0) => replay(events, offset).messages;

/**
 * The first event a fork through `messageId` must leave out: the start of the next user message or
 * model call. Undefined keeps the whole log. Throws when the message is not in this session.
 */
export const forkBoundary = (events: readonly SessionEvent[], messageId: string) => {
  const start = replay(events, 0).starts.get(messageId);
  if (start === undefined) throw new Error(`Message ${messageId} is not in this Copilot session.`);
  return events.find(
    (event, position) =>
      position > start && !event.ephemeral && (event.type === "user.message" || event.type === "assistant.turn_start"),
  )?.id;
};
