import { expect, test } from "bun:test";
import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import { nativeSubmissionIndex } from "./native-submission";

type SessionDetails = Awaited<ReturnType<ExtensionSessionsApi["getConversation"]>>["session"];

import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { readSnapshot } from "./snapshot";

const session: SessionDetails = {
  id: "s",
  title: "Saved",
  status: "in_progress",
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
  projectId: "p",
  agentSessionId: "native",
  sessionFileId: null,
  params: { thinking: "low" },
  device: { ownerId: "owner", id: "laptop", name: "Laptop" },
};
const queue = { requests: [], activeRunStartedAt: "run", steeringAvailable: false, steeringUnavailableReason: null };
const fixture = (remote: boolean, available: boolean) =>
  makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    projectId: "p",
    overrides: {
      workspaces: { list: async () => [] },
      account: {
        devices: async () => [],
        status: async () => {
          throw new Error("Local sessions must not infer ownership from account login");
        },
      },
      sessions: {
        get: async () => ({
          ...session,
          usage: null,
          anchors_json: [],
          last_selected_model: session.lastSelectedModel,
          workspace_id: session.workspaceId,
          original_session_id: session.originalSessionId,
          created_at: session.createdAt,
          updated_at: session.updatedAt,
          last_request_started: session.lastRequestStarted,
          last_request_ended: session.lastRequestEnded,
        }),
        getConversationSources: async () => ({
          checkpoint: [],
          native: null,
          checkpointError: null,
          nativeError: null,
        }),
        getConversation: async () => ({ session: remote ? session : { ...session, device: undefined }, messages: [] }),
        getQueuedMessages: async () => ({ messages: [], queue }),
        getExecutionState: async () => ({
          kind: remote ? "remote" : "local",
          available,
          device: remote ? { id: "laptop", name: "Laptop" } : undefined,
        }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
      },
    },
  });

test("online remote owners keep controls and unavailable history becomes read only", async () => {
  const resource = { type: "session", id: "s", extensionId: "pstdio", projectId: "p" };
  expect(await readSnapshot(fixture(true, true), resource)).toMatchObject({
    readOnly: false,
    nativeHarnessAccount: { controlId: "harness", remote: true },
    notice: "Working on Laptop.",
  });
  expect(await readSnapshot(fixture(true, false), resource)).toMatchObject({ readOnly: true });
  expect(await readSnapshot(fixture(false, true), resource)).toMatchObject({
    readOnly: false,
    nativeHarnessAccount: { controlId: "harness", remote: false },
  });
});

test("a project without a local folder keeps a usable composer and explicit public host bindings", async () => {
  const ctx = fixture(false, true);
  const snapshot = await readSnapshot(ctx);
  expect(snapshot.submitDisabled).not.toBe(true);
  expect(snapshot.nativeLinks).toBe(true);
  expect(snapshot.nativeHarnessAccount).toEqual({ controlId: "harness" });
});

test("a remote-device draft keeps its public host binding across reload without discovering a local harness", async () => {
  const ctx = fixture(false, true);
  ctx.account.devices = async () => [
    { id: "laptop", name: "Laptop", current: false, online: true, platform: "test", createdAt: "", lastSeenAt: "" },
  ];
  ctx.sessions.getDraftHarnessCommands = async () => {
    throw new Error("Remote draft must not discover local harness commands");
  };
  const { saveDraft } = await import("./drafts");
  await saveDraft(ctx, "draft", {
    text: "Unsent on Laptop",
    attachments: [],
    values: { device: "laptop", harness: { harnessId: "remote-agent", model: "B" } },
  });
  const snapshot = await readSnapshot(ctx);
  expect(snapshot).toMatchObject({
    nativeHarnessAccount: { controlId: "harness", remote: true },
    values: { device: "laptop", harness: { harnessId: "remote-agent", model: "B" } },
  });
  expect(snapshot.submitDisabled).not.toBe(true);
  expect(snapshot.harness).toBeUndefined();
});

test("unavailable remote queue leaves online execution usable with a refresh operation", async () => {
  const ctx = fixture(true, true);
  ctx.sessions.getQueuedMessages = async () => {
    throw new Error("Queue connection interrupted");
  };
  const snapshot = await readSnapshot(ctx, { type: "session", id: "s", extensionId: "pstdio" });
  expect(snapshot).toMatchObject({ readOnly: false, queueReadOnly: true, operations: [{ id: "refresh-queue" }] });
  expect(snapshot.messages).toEqual([]);
  expect(snapshot.queuedFollowUps).toBeUndefined();
});

test("reply controls request per-reply fork availability while later work continues", async () => {
  const ctx = fixture(false, true);
  const requests: unknown[] = [];
  ctx.sessions.getForkState = async (...args) => {
    requests.push(args);
    return { supported: true, disabledReason: args[1]?.scope === "reply" ? null : "Session has pending work." };
  };
  const snapshot = await readSnapshot(ctx, { type: "session", id: "s", extensionId: "pstdio" });
  expect(requests).toEqual([["s", { scope: "reply" }]]);
  expect(snapshot).toMatchObject({ streaming: true, fork: { disabledReason: null } });
});
