import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { act } from "./actions";
import { nativeSubmissionIndex } from "./native-submission";
import { readSnapshot } from "./snapshot";

test("saved-session snapshot offers reply fork and dispatch preserves its completed message ID", async () => {
  const forks: unknown[] = [];
  const navigation: unknown[] = [];
  const saved = { id: "source", title: "Saved", status: "completed", agent: "fixture", params: {}, workspaceId: null };
  const reply = {
    id: "completed-assistant",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "Completed reply" }],
  };
  const ctx = makeCommandContext({
    params: {},
    projectId: "p",
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    overrides: {
      workspaces: { list: async () => [] },
      account: { devices: async () => [] },
      navigation: {
        open: (target) => {
          navigation.push(target);
        },
      },
      sessions: {
        getExecutionState: async () => ({ kind: "local", available: true }),
        getConversation: async () => ({ session: saved, messages: [reply] }) as never,
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: true, steeringUnavailableReason: null },
        }),
        getHarnessCommands: async () => ({ harnessId: "fixture", commands: [], modes: [], slashCommands: true }),
        getForkState: async () => {
          throw new Error("The host reply action must not depend on native harness fork discovery.");
        },
        fork: async (...args) => {
          forks.push(args);
          return { ...saved, id: "forked" } as never;
        },
      },
    },
  });
  const renderer = {
    rendererId: "conversation",
    resource: { type: "session", id: "source", extensionId: "pstdio", projectId: "p" },
  };
  const snapshot = await readSnapshot(ctx, renderer.resource);
  expect(snapshot.messages).toMatchObject([{ id: "completed-assistant", role: "assistant" }]);
  expect(snapshot.fork).toEqual({ disabledReason: null });
  await act(ctx, { renderer, action: { type: "fork", messageId: reply.id }, draftKey: "source" });
  expect(forks).toEqual([["source", "completed-assistant"]]);
  expect(navigation).toMatchObject([{ kind: "page", resource: { id: "forked", extensionId: "pstdio" } }]);
});
