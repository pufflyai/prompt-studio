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
import type { CopilotClientFactory, CopilotClientHandle, CopilotSessionHandle } from "./client";
import { ASK_USER, isSubagent, normalizeCopilotEvents } from "./events";

export type CopilotTurnInput = HarnessStartInput & { agentSessionId?: string; approvals?: HarnessApprovalChannel };

/** How often a running turn checks that the Copilot runtime still answers, and how long it waits. */
export const LIVENESS = { intervalMs: 15_000, timeoutMs: 30_000 };

/** How long a request to a possibly unresponsive runtime may take before the turn stops waiting for it. */
export const RPC_DEADLINE = { ms: 10_000 };

/** Settles when `promise` does, or after `ms`, so an unresponsive runtime cannot hold a turn open. */
const within = (promise: Promise<unknown>, ms = RPC_DEADLINE.ms) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise.catch(() => {}), new Promise((resolve) => (timer = setTimeout(resolve, ms)))]).finally(
    () => clearTimeout(timer),
  );
};

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

const cancelledError = () => Object.assign(new Error("The Copilot turn was cancelled."), { name: "AbortError" });

/**
 * One host turn = one short-lived Copilot runtime. The runtime gets the host session id in its
 * environment, and stopping it never loses history because Copilot persists every session event.
 * Returns synchronously so the caller can stop a turn that is still starting.
 */
export const startCopilotTurn = (
  input: CopilotTurnInput,
  factory: CopilotClientFactory,
  env: Record<string, string> | Promise<Record<string, string>>,
) => {
  // Created once the environment, including any saved token, is known.
  let client: CopilotClientHandle | undefined;
  const prefix = [...input.events.getMessages()];
  const events: SessionEvent[] = [];
  // Host-side parts for user input, so the conversation shows attachments as the person sent them.
  const submitted = new Map<string | undefined, SessionMessagePart[]>([
    [undefined, promptParts(input.prompt, input.attachments)],
  ]);
  // Steered input waiting for Copilot to take it in, keyed by delivery id.
  const deliveries = new Map<string, (taken: boolean) => void>();
  const idle = Promise.withResolvers<HarnessExit>();
  let session: CopilotSessionHandle | undefined;
  let pendingAsk: string | undefined;
  let stopped = false;
  let ended = false;
  let failed = false;
  // The runtime stopped answering, so the turn must not wait on it again.
  let unresponsive = false;
  // A session.idle left over from resuming must not end this turn before it starts.
  let begun = false;

  const seen = (deliveryId: string) =>
    events.some((event) => event.type === "user.message" && event.data.clientTurnId === deliveryId);

  const publish = () => {
    const messages = normalizeCopilotEvents(events, prefix.length, ended);
    // The turn's own prompt comes first; later user messages are steered input with delivery ids.
    for (const [position, message] of messages.filter((message) => message.role === "user").entries()) {
      const parts = submitted.get(position === 0 ? undefined : message.id);
      if (parts) message.parts = parts;
    }
    publishConversationChanges(input.events, [...prefix, ...messages]);
  };

  const exitStatus = (): HarnessExit["status"] => {
    if (stopped) return "cancelled";
    return failed ? "failed" : "completed";
  };

  // Subagent events belong to a parent tool call and never change the turn's own state.
  const track = (event: SessionEvent) => {
    if (event.type === "user.message") {
      begun = true;
      if (event.data.clientTurnId) deliveries.get(event.data.clientTurnId)?.(true);
    } else if (event.type === "tool.execution_start" && event.data.toolName === ASK_USER) {
      pendingAsk = event.data.toolCallId;
    } else if (event.type === "session.error") {
      failed = true;
    } else if (event.type === "abort") {
      idle.resolve({ status: "cancelled" });
    } else if (event.type === "session.idle" && begun) {
      idle.resolve({ status: exitStatus() });
    }
  };

  const observe = (event: SessionEvent) => {
    events.push(event);
    if (!isSubagent(event)) track(event);
    if (!event.ephemeral || event.type.endsWith("_delta")) publish();
  };

  const opened = (async () => {
    try {
      input.signal?.throwIfAborted();
      const runtimeEnv = await env;
      if (stopped) throw cancelledError();
      client = factory({ cwd: input.cwd, env: runtimeEnv });
      await client.start();
      if (stopped) throw cancelledError();
      const config = {
        model: input.model ?? undefined,
        // Models list their own levels; "default" leaves the choice to Copilot.
        reasoningEffort:
          typeof input.params?.reasoning === "string" && input.params.reasoning !== "default"
            ? input.params.reasoning
            : undefined,
        streaming: true,
        workingDirectory: input.cwd,
        // Load the project's instructions, skills, agents and MCP servers the way the Copilot CLI does.
        enableConfigDiscovery: true,
        permissionMode: input.params?.permission_mode === "manual" ? ("manual" as const) : ("allow-all" as const),
        onPermissionRequest: permissionHandler(input.approvals),
        ...(input.questions ? { onUserInputRequest: userInputHandler(input.questions, () => pendingAsk) } : {}),
      };
      const created = input.agentSessionId
        ? await client.resumeSession(input.agentSessionId, config)
        : await client.createSession(config);
      if (stopped) throw cancelledError();
      session = created;
      return created;
    } catch (error) {
      await client?.forceStop().catch(() => {});
      throw error;
    }
  })();

  const run = async (active: CopilotSessionHandle): Promise<HarnessExit> => {
    const runtime = client!;
    const unsubscribe = active.on(observe);
    // The SDK does not tell its callers when the runtime dies, so a running turn checks it answers.
    const liveness = setInterval(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          runtime.ping(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("The Copilot runtime stopped answering.")), LIVENESS.timeoutMs);
          }),
        ]);
      } catch {
        failed = true;
        unresponsive = true;
        idle.resolve({ status: stopped ? "cancelled" : "failed" });
      } finally {
        clearTimeout(timer);
      }
    }, LIVENESS.intervalMs);
    try {
      // The send itself can hang on a dead runtime; the watchdog then ends the turn through `idle`.
      await Promise.race([
        active.send({ prompt: input.prompt, attachments: nativeAttachments(input.attachments) }).then(() => {
          begun = true;
        }),
        idle.promise,
      ]);
      return await idle.promise;
    } catch {
      return { status: stopped || input.signal?.aborted ? "cancelled" : "failed" };
    } finally {
      clearInterval(liveness);
      ended = true;
      publish();
      for (const [deliveryId, settle] of deliveries) settle(seen(deliveryId));
      unsubscribe();
      // stop() detaches the session with its own deadline; a runtime that stopped answering is killed.
      if (unresponsive) await runtime.forceStop().catch(() => {});
      else
        await runtime
          .stop()
          .catch(() => runtime.forceStop())
          .catch(() => {});
    }
  };

  const done: Promise<HarnessExit> = opened.then(run, () => ({
    status: stopped || input.signal?.aborted ? "cancelled" : "failed",
  }));

  const stop = async () => {
    stopped = true;
    idle.resolve({ status: "cancelled" });
    if (session) await within(session.abort());
    else await client?.forceStop().catch(() => {});
    await done;
  };
  input.signal?.addEventListener("abort", () => void stop(), { once: true });

  /** Deliver input into the running turn. Copilot echoes the delivery id on the user message it saves. */
  const steer = async (steering: HarnessSteeringInput): Promise<HarnessSteeringResult> => {
    steering.signal?.throwIfAborted();
    if (!session || ended || stopped) return { status: "rejected", reason: "The Copilot turn has ended." };
    // Copilot takes steered input at its next model call, which can follow a long tool run, so wait
    // until it does or the turn ends rather than for a fixed time.
    const taken = Promise.withResolvers<boolean>();
    const cancel = () => taken.resolve(false);
    steering.signal?.addEventListener("abort", cancel, { once: true });
    deliveries.set(steering.deliveryId, taken.resolve);
    submitted.set(steering.deliveryId, promptParts(steering.prompt, steering.attachments));
    try {
      await session.send({
        prompt: steering.prompt,
        attachments: nativeAttachments(steering.attachments),
        mode: "immediate",
        clientTurnId: steering.deliveryId,
      });
      if (await taken.promise) return { status: "accepted" };
      return { status: "uncertain", reason: "Copilot did not confirm the input before the turn ended." };
    } catch (error) {
      return { status: "uncertain", reason: error instanceof Error ? error.message : String(error) };
    } finally {
      steering.signal?.removeEventListener("abort", cancel);
      deliveries.delete(steering.deliveryId);
    }
  };

  const harnessSession = opened.then(
    (active) =>
      ({
        agentSessionId: active.sessionId,
        done,
        stop,
        steer,
        timeoutStrategy: "provider",
      }) satisfies HarnessSession,
  );
  void harnessSession.catch(() => {});
  return { session: harnessSession, done, stop };
};
