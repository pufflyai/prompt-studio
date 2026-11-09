import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { nativeSubmissionIndex } from "./native-submission";
import { watchConversation } from "./watch";

const session = {
  id: "s",
  title: "Session",
  status: "completed" as const,
  archived: false,
  agent: "agent",
  cwd: null,
  lastSelectedModel: "A",
  workspaceId: null,
  originalSessionId: null,
  createdAt: "",
  updatedAt: "",
  lastRequestStarted: null,
  lastRequestEnded: null,
  usage: null,
  last_selected_model: "A",
  workspace_id: null,
  original_session_id: null,
  created_at: "",
  updated_at: "",
  last_request_started: null,
  last_request_ended: null,
  anchors_json: [],
  projectId: "p",
  agentSessionId: "native",
  sessionFileId: null,
  params: {},
};

test("a failed refresh cancels its live subscription and releases retained resources", async () => {
  const controller = new AbortController();
  const failed = Promise.withResolvers<void>();
  let reads = 0;
  let closed = 0;
  let subscriptionSignal: AbortSignal | undefined;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      sessions: {
        get: async () => session,
        getQueuedMessages: async () => ({
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
          messages: [],
        }),
        getExecutionState: async () => {
          if (++reads > 1) {
            failed.resolve();
            throw new Error("Session no longer available");
          }
          return { kind: "local", available: true };
        },
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => closed++ }),
        stream: async (_id, _onEvent, options) => {
          subscriptionSignal = options?.signal;
          await new Promise<void>((resolve) => {
            if (subscriptionSignal?.aborted) resolve();
            else subscriptionSignal?.addEventListener("abort", () => resolve(), { once: true });
          });
        },
      },
    },
  });
  const watching = watchConversation(ctx, { type: "session", id: "s" }).catch((error) => error);
  try {
    await failed.promise;
    await Bun.sleep(0);
    expect(subscriptionSignal?.aborted).toBe(true);
    expect(closed).toBe(1);
    expect(await watching).toMatchObject({ message: "Session no longer available" });
    expect(controller.signal.aborted).toBe(false);
  } finally {
    controller.abort();
    await watching;
  }
});
