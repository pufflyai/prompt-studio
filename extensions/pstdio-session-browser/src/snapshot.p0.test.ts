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
  expect(snapshot).toMatchObject({
    readOnly: false,
    queueReadOnly: true,
    operations: [{ id: "connection", refresh: true }, { id: "refresh-queue" }],
  });
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

test("native failure and clearing preserve queue and offline device feedback", async () => {
  const { saveNativeSubmission } = await import("./native-submission");
  const resource = { type: "session", id: "s", extensionId: "pstdio", projectId: "p" };
  for (const remote of [false, true]) {
    const ctx = fixture(remote, !remote);
    const get = ctx.sessions.get;
    ctx.sessions.get = async (id) => ({ ...(await get(id))!, status: "failed", lastRequestStarted: "native" });
    ctx.sessions.getConversation = async () => ({
      session: { ...session, status: "failed", lastRequestStarted: "native" },
      messages: [],
    });
    if (!remote)
      ctx.sessions.getQueuedMessages = async () => {
        throw new Error("Queue is recovering");
      };
    await saveNativeSubmission(
      ctx,
      "s",
      { draft: { text: "/fail", attachments: [], values: {} }, operation: { kind: "command", text: "/fail" } },
      "before",
      true,
      "native",
    );
    expect((await readSnapshot(ctx, resource)).notice).toBe(
      remote ? "Laptop is offline. Reconnect it before sending." : "Queue is recovering",
    );
  }
});

test("offline remote history exposes safe host refresh and hides unavailable workspace execution", async () => {
  const ctx = fixture(true, false);
  const get = ctx.sessions.get;
  ctx.sessions.get = async (id) => ({ ...(await get(id))!, workspaceId: "remote-workspace" });
  const snapshot = await readSnapshot(ctx, { type: "session", id: "s" });
  expect(snapshot.readOnly).toBe(true);
  expect(snapshot.operations).toContainEqual({ id: "connection", label: "Check connection", refresh: true });
  expect(snapshot.resources).toEqual([]);
  expect(snapshot.workspaceId).toBe("remote-workspace");
});

test("changing draft device selects an available workspace on that owner and preserves a valid saved choice", async () => {
  const ctx = fixture(false, true);
  ctx.account.devices = async () => [
    { id: "laptop", name: "Laptop", current: false, online: true, platform: "test", createdAt: "", lastSeenAt: "" },
  ];
  ctx.workspaces.list = async () =>
    [
      { id: "local", isDefault: true },
      { id: "remote-first", device: { id: "laptop", ownerId: "owner", name: "Laptop" } },
      { id: "remote-second", device: { id: "laptop", ownerId: "owner", name: "Laptop" } },
      { id: "other-device", isDefault: true, device: { id: "other", ownerId: "owner", name: "Other" } },
    ] as never;
  const changed = await readSnapshot(ctx, undefined, { device: "laptop", workspace: "" });
  expect(changed.values?.workspace).toBe("remote-first");
  expect(changed.nativeHarnessAccount?.remote).toBe(true);
  const stale = await readSnapshot(ctx, undefined, { device: "laptop", workspace: "local" });
  expect(stale.values?.workspace).toBe("remote-first");
  const saved = await readSnapshot(ctx, undefined, { device: "laptop", workspace: "remote-second" });
  expect(saved.values?.workspace).toBe("remote-second");
  ctx.workspaces.list = async () => [];
  const noFolder = await readSnapshot(ctx, undefined, { device: "laptop", workspace: "remote-second" });
  expect(noFolder.values?.workspace).toBe("");
  expect(noFolder.submitDisabled).toBe(false);
});
