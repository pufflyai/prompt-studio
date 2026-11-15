import type { SessionEvent } from "@github/copilot-sdk";
import type {
  HarnessApprovalChannel,
  HarnessAttachment,
  HarnessExit,
  HarnessSession,
  HarnessStartInput,
  HarnessSteeringInput,
  HarnessSteeringResult,
  SessionMessagePart,
} from "@pstdio/sdk/extensions";
import { publishConversationChanges } from "@pstdio/sdk/extensions";
import { permissionHandler, userInputHandler } from "./channels";
import type { CopilotClientFactory } from "./client";
import { normalizeCopilotEvents } from "./events";

export type CopilotTurnInput = HarnessStartInput & { agentSessionId?: string; approvals?: HarnessApprovalChannel };

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

const reasoningEffort = (value: unknown) =>
  REASONING_EFFORTS.includes(value as ReasoningEffort) ? (value as ReasoningEffort) : undefined;

/** How long Copilot may take to take in steered input before its delivery counts as uncertain. */
const STEER_ACK_MS = 30_000;

const promptParts = (prompt: string, attachments: HarnessAttachment[] = []): SessionMessagePart[] => [
  { type: "text", text: prompt },
  ...attachments.map((file) => ({
    type: "file" as const,
    fileId: file.fileId,
    filename: file.fileName,
    mediaType: file.mimeType ?? undefined,
    size: file.sizeBytes,
    url: file.url,
  })),
];

const nativeAttachments = (attachments: HarnessAttachment[] = []) =>
  attachments.map((file) => ({ type: "file" as const, path: file.localPath, displayName: file.fileName }));

/**
 * One host turn = one short-lived Copilot runtime. The runtime gets the host session id in its
 * environment, and stopping it never loses history because Copilot persists every session event.
 */
export const startCopilotTurn = async (
  input: CopilotTurnInput,
  factory: CopilotClientFactory,
  env: Record<string, string>,
) => {
  input.signal?.throwIfAborted();
  const client = factory({ cwd: input.cwd, env });
  const prefix = [...input.events.getMessages()];
  const events: SessionEvent[] = [];
  // Host-side parts for user input, so the conversation shows attachments as the person sent them.
  const submitted = new Map<string | undefined, SessionMessagePart[]>([
    [undefined, promptParts(input.prompt, input.attachments)],
  ]);
  // Steered input waiting for Copilot to take it in, keyed by delivery id.
  const deliveries = new Map<string, (taken: boolean) => void>();
  let pendingAsk: string | undefined;
  let stopped = false;
  let settled = false;

  const seen = (deliveryId: string) =>
    events.some((event) => event.type === "user.message" && event.data.clientTurnId === deliveryId);

  const publish = () => {
    const messages = normalizeCopilotEvents(events, prefix.length);
    // The turn's own prompt comes first; later user messages are steered input with delivery ids.
    for (const [position, message] of messages.filter((message) => message.role === "user").entries()) {
      const parts = submitted.get(position === 0 ? undefined : message.id);
      if (parts) message.parts = parts;
    }
    publishConversationChanges(input.events, [...prefix, ...messages]);
  };

  await client.start();
  const config = {
    model: input.model ?? undefined,
    reasoningEffort: reasoningEffort(input.params?.reasoning),
    streaming: true,
    workingDirectory: input.cwd,
    // Load the project's instructions, skills, agents and MCP servers the way the Copilot CLI does.
    enableConfigDiscovery: true,
    permissionMode: input.params?.permission_mode === "manual" ? ("manual" as const) : ("allow-all" as const),
    onPermissionRequest: permissionHandler(input.approvals),
    ...(input.questions ? { onUserInputRequest: userInputHandler(input.questions, () => pendingAsk) } : {}),
  };
  let session: Awaited<ReturnType<typeof client.createSession>>;
  try {
    session = input.agentSessionId
      ? await client.resumeSession(input.agentSessionId, config)
      : await client.createSession(config);
  } catch (error) {
    await client.forceStop().catch(() => {});
    throw error;
  }

  const idle = Promise.withResolvers<HarnessExit>();
  let failed = false;
  const unsubscribe = session.on((event) => {
    if (event.type === "tool.execution_start" && event.data.toolName === "ask_user") pendingAsk = event.data.toolCallId;
    if (event.type === "session.error") failed = true;
    events.push(event);
    if (event.type === "user.message" && event.data.clientTurnId) deliveries.get(event.data.clientTurnId)?.(true);
    if (event.type === "abort" || (event.type === "session.idle" && stopped)) idle.resolve({ status: "cancelled" });
    else if (event.type === "session.idle") idle.resolve({ status: failed ? "failed" : "completed" });
    if (!event.ephemeral || event.type.endsWith("_delta")) publish();
  });

  const done = (async (): Promise<HarnessExit> => {
    try {
      await session.send({ prompt: input.prompt, attachments: nativeAttachments(input.attachments) });
      return await idle.promise;
    } catch {
      return { status: stopped || input.signal?.aborted ? "cancelled" : "failed" };
    } finally {
      settled = true;
      for (const [deliveryId, settle] of deliveries) settle(seen(deliveryId));
      unsubscribe();
      await session.disconnect().catch(() => {});
      await client.stop().catch(() => client.forceStop());
    }
  })();

  const stop = async () => {
    stopped = true;
    await session.abort().catch(() => {});
    idle.resolve({ status: "cancelled" });
    await done;
  };
  input.signal?.addEventListener("abort", () => void stop(), { once: true });

  /** Deliver input into the running turn. Copilot echoes the delivery id on the user message it saves. */
  const steer = async (steering: HarnessSteeringInput): Promise<HarnessSteeringResult> => {
    steering.signal?.throwIfAborted();
    if (settled || stopped) return { status: "rejected", reason: "The Copilot turn has ended." };
    const acknowledged = Promise.withResolvers<boolean>();
    const timer = setTimeout(() => acknowledged.resolve(false), STEER_ACK_MS);
    const cancel = () => acknowledged.resolve(false);
    steering.signal?.addEventListener("abort", cancel, { once: true });
    deliveries.set(steering.deliveryId, acknowledged.resolve);
    submitted.set(steering.deliveryId, promptParts(steering.prompt, steering.attachments));
    try {
      await session.send({
        prompt: steering.prompt,
        attachments: nativeAttachments(steering.attachments),
        mode: "immediate",
        clientTurnId: steering.deliveryId,
      });
      if (await acknowledged.promise) return { status: "accepted" };
      return { status: "uncertain", reason: "Copilot did not confirm the input before the turn ended." };
    } catch (error) {
      return { status: "uncertain", reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
      steering.signal?.removeEventListener("abort", cancel);
      deliveries.delete(steering.deliveryId);
    }
  };

  return {
    agentSessionId: session.sessionId,
    done,
    stop,
    steer,
    timeoutStrategy: "provider",
  } satisfies HarnessSession;
};
