import type { HarnessEventSink, HarnessExit } from "@pstdio/sdk/extensions";
import { isAssistant, normalizeMessages, readAgentMessages, readConversation } from "./messages";
import {
  getWorkspace,
  isTerminal,
  type PocketCoderContext,
  type PocketCoderWorkspace,
  request,
  wait,
  workspacePath,
} from "./pocketcoder";

const terminalExit = (workspace: PocketCoderWorkspace) => {
  if (workspace.state === "canceled") return { status: "cancelled" } satisfies HarnessExit;
  if (workspace.state === "succeeded") return { status: "completed" } satisfies HarnessExit;
  return { status: "failed" } satisfies HarnessExit;
};

export const pollAgent = async (input: {
  ctx: PocketCoderContext;
  id: string;
  baseline: number;
  events: HarnessEventSink;
  signal: AbortSignal;
}) => {
  const { ctx, id, baseline, events, signal } = input;
  let previous = "";
  while (!signal.aborted) {
    const workspace = await getWorkspace(ctx, id, signal);
    if (isTerminal(workspace)) {
      events.push({ op: "replace", path: "/messages", value: await readConversation(ctx, id, signal) });
      return terminalExit(workspace);
    }
    if (workspace.state !== "ready") throw new Error(`PocketCoder workspace is ${workspace.state}.`);
    const messages = await readAgentMessages(ctx, id, signal);
    const snapshot = JSON.stringify(messages);
    if (snapshot !== previous) {
      events.push({ op: "replace", path: "/messages", value: normalizeMessages(id, messages) });
      previous = snapshot;
    }
    const status = await request<{ status: "running" | "stable" }>(ctx, {
      method: "GET",
      path: `${workspacePath(id)}/agent/status`,
      signal,
    });
    if (status.status === "stable" && messages.some((message) => message.id > baseline && isAssistant(message))) {
      // The agent can finish between the transcript and status reads. Fetch its final snapshot.
      events.push({
        op: "replace",
        path: "/messages",
        value: normalizeMessages(id, await readAgentMessages(ctx, id, signal)),
      });
      return { status: "completed" } satisfies HarnessExit;
    }
    if (status.status !== "stable" && status.status !== "running") throw new Error("Unknown PocketCoder agent status.");
    await wait(signal);
  }
  return { status: "disconnected" } satisfies HarnessExit;
};
