import type { ChatRendererStreamEvent, CommandContext, SessionMetadataChange } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { nativeSubmissionIndex } from "./native-submission";

export const createWatchObservationFixture = () => {
  const controller = new AbortController();
  const connected = Promise.withResolvers<void>();
  const counts = { execution: 0, session: 0, queue: 0, harness: 0, workspace: 0, stream: 0, closed: 0 };
  const session = {
    id: "s",
    title: "Session",
    status: "completed" as "completed" | "failed",
    archived: false,
    agent: "agent",
    cwd: null,
    lastSelectedModel: "A",
    workspaceId: "w",
    originalSessionId: null,
    createdAt: "",
    updatedAt: "",
    lastRequestStarted: null as string | null,
    lastRequestEnded: null,
    usage: null,
    last_selected_model: "A",
    workspace_id: "w",
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
  const queue = { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null };
  let notify: (change: SessionMetadataChange) => void = () => {};
  const frames: ChatRendererStreamEvent[] = [];
  const state = {
    command: "/first",
    wrote: (_frame: ChatRendererStreamEvent) => {},
    readExecution: async () => ({ kind: "local" as const, available: true }),
    stream: async (_onEvent: Parameters<CommandContext["sessions"]["stream"]>[1], signal?: AbortSignal) => {
      await new Promise<void>((resolve) => {
        if (signal?.aborted) resolve();
        else signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    },
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (frame) => {
          frames.push(frame as ChatRendererStreamEvent);
          state.wrote(frame as ChatRendererStreamEvent);
        },
      },
      workspaces: {
        get: async () => {
          counts.workspace++;
          return null;
        },
      },
      sessions: {
        observeMetadata: async (_id, changed) => {
          notify = changed;
          return {
            close: () => {
              notify = () => {};
            },
          };
        },
        get: async () => {
          counts.session++;
          return { ...session };
        },
        getExecutionState: async () => {
          counts.execution++;
          return state.readExecution();
        },
        getQueuedMessages: async () => {
          counts.queue++;
          return { queue, messages: [] };
        },
        getHarnessCommands: async () => {
          counts.harness++;
          return {
            harnessId: "agent",
            commands: [{ name: state.command, description: "Command" }],
            modes: [],
            slashCommands: true,
          };
        },
        retainResources: async () => ({
          close: () => {
            counts.closed++;
          },
        }),
        stream: async (_id, onEvent, options) => {
          counts.stream++;
          connected.resolve();
          await state.stream(onEvent, options?.signal);
        },
      },
    },
  });
  return {
    ctx,
    controller,
    connected: connected.promise,
    counts,
    session,
    state,
    frames,
    change: (field: SessionMetadataChange) => notify(field),
  };
};
