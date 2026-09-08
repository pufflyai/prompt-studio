import {
  defineHarness,
  type HarnessContext,
  type HarnessExit,
  type HarnessReattachInput,
  type HarnessResumeInput,
  type HarnessSession,
  type HarnessStartInput,
  l10n,
} from "@pstdio/sdk/extensions";
import { pollAgent } from "./agent-poller";
import { getMessages, readAgentMessages } from "./messages";
import { cancelWorkspace, getWorkspace, isTerminal, PocketCoderError, request, workspacePath } from "./pocketcoder";
import { clearTurnCursor, readTurnCursor, saveTurnCursor } from "./turn-cursor";
import { remoteId } from "./workspace";

const workspaceId = (ctx: HarnessContext, workspace?: HarnessStartInput["workspace"], agentSessionId?: string) => {
  const target = workspace?.executionTarget;
  if (target?.kind !== "remote" || target.providerId !== `${ctx.extensionId}.workspace-type.remote`) {
    throw new Error("Choose a PocketCoder workspace for this agent.");
  }
  const id = remoteId(target.providerRef);
  if (agentSessionId && agentSessionId !== id)
    throw new Error("The session belongs to a different PocketCoder workspace.");
  return id;
};

const attach = (
  ctx: HarnessContext,
  input: HarnessStartInput | HarnessReattachInput,
  id: string,
  baseline: number,
  prompt?: string,
) => {
  const controller = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, controller.signal]) : controller.signal;
  let stopping: Promise<HarnessExit> | undefined;
  const stop = () => {
    if (!stopping) {
      stopping = cancelWorkspace(ctx, id).then(() => ({ status: "cancelled" as const }));
      controller.abort();
    }
    return stopping.then(() => {});
  };
  const onAbort = () => {
    void stop().catch((error) => ctx.logger.warn(String(error)));
  };
  if (prompt !== undefined) input.signal?.addEventListener("abort", onAbort, { once: true });

  const poll = async () => {
    if (prompt !== undefined) {
      // Keep the workspace identity for recovery and inspect ambiguous submits without replaying them.
      try {
        await request(ctx, {
          method: "POST",
          path: `${workspacePath(id)}/agent/message`,
          body: { content: prompt, type: "user" },
          signal,
        });
      } catch (error) {
        if (signal.aborted || (error instanceof PocketCoderError && error.status < 500)) throw error;
        ctx.logger.warn(`PocketCoder did not confirm the prompt. Checking the existing conversation: ${String(error)}`);
      }
    }
    return pollAgent({ ctx, id, baseline, events: input.events, signal });
  };

  const done = poll()
    .catch((error: unknown) => {
      if (stopping || signal.aborted) return { status: "disconnected" } satisfies HarnessExit;
      if (error instanceof PocketCoderError && error.status < 500) throw error;
      ctx.logger.warn(`PocketCoder connection lost: ${String(error)}`);
      return { status: "disconnected" } satisfies HarnessExit;
    })
    .then(async (exit) => {
      const result = stopping ? await stopping.catch(() => ({ status: "disconnected" as const })) : exit;
      if (result.status !== "disconnected") await clearTurnCursor(ctx, input.sessionId);
      return result;
    })
    .finally(() => input.signal?.removeEventListener("abort", onAbort));

  return { agentSessionId: id, done, stop, timeoutStrategy: "provider" } satisfies HarnessSession;
};

const send = async (ctx: HarnessContext, input: HarnessStartInput | HarnessResumeInput) => {
  const id = workspaceId(ctx, input.workspace, "agentSessionId" in input ? input.agentSessionId : undefined);
  if (input.attachments?.length) throw new Error("PocketCoder attachments are not supported by this extension yet.");
  const workspace = await getWorkspace(ctx, id, input.signal);
  if (workspace.state !== "ready")
    throw new Error(`PocketCoder workspace is ${workspace.state}. Create a new workspace to continue.`);
  const before = await readAgentMessages(ctx, id, input.signal);
  input.signal?.throwIfAborted();
  const baseline = before.reduce((maximum, message) => Math.max(maximum, message.id), -1);
  await saveTurnCursor(ctx, input.sessionId, id, baseline);
  return attach(ctx, input, id, baseline, input.prompt);
};

export const remoteHarness = defineHarness({
  id: "remote-agent",
  label: l10n("harnesses.remote-agent", "PocketCoder agent"),
  cwdRequirement: "optional",
  capabilities: () => ["SessionReattach"],
  start: send,
  resume: send,
  async reattach(ctx, input) {
    const id = workspaceId(ctx, input.workspace, input.agentSessionId);
    const workspace = await getWorkspace(ctx, id, input.signal);
    const baseline = isTerminal(workspace) ? -1 : await readTurnCursor(ctx, input.sessionId, id);
    return attach(ctx, input, id, baseline);
  },
  getMessages(ctx, input) {
    return getMessages(ctx, workspaceId(ctx, input.workspace, input.agentSessionId));
  },
});
