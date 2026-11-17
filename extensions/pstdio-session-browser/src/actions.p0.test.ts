import { expect, test } from "bun:test";
import { workspaceCommands } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { act } from "./actions";
import { readDraft, saveDraft } from "./drafts";

test("Open workspace delegates identity and destination policy to its public owner", async () => {
  const opened: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      navigation: { open: (target) => opened.push(target) },
    },
  });
  await act(ctx, {
    renderer: { rendererId: "sessions", resource: { type: "session", id: "remote-session" } },
    draftKey: "remote-session",
    action: { type: "openResource", id: "remote-workspace" },
  });
  expect(opened).toEqual([
    { kind: "command", target: { command: workspaceCommands.open, params: { id: "remote-workspace" } } },
  ]);
});

const created = {
  type: "session" as const,
  id: "created",
  title: "Saved",
  status: "in_progress" as const,
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
};

test("slow creation does not overwrite newer durable files and settings when the prompt text is unchanged", async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let sends = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        create: async () => {
          sends++;
          started.resolve();
          await release.promise;
          return created;
        },
      },
      navigation: { open: () => {} },
    },
  });
  const draft = {
    text: "Send this",
    attachments: [{ id: "A", name: "A.txt" }],
    values: { harness: { harnessId: "agent", model: "A" }, workspace: "first" },
  };
  await saveDraft(ctx, "draft", draft);
  const submitting = act(ctx, {
    renderer: { rendererId: "sessions", resource: { type: "session-draft", id: "draft" } },
    draftKey: "draft",
    action: { type: "submit", text: draft.text, attachments: draft.attachments, values: draft.values },
  });
  await started.promise;
  const newer = {
    ...draft,
    attachments: [...draft.attachments, { id: "B", name: "B.txt" }],
    values: { harness: { harnessId: "agent", model: "B" }, workspace: "second" },
  };
  await saveDraft(ctx, "draft", newer);
  release.resolve();
  await submitting;
  expect(await readDraft(ctx, "draft")).toEqual(newer);
  expect(sends).toBe(1);
});

test("new-session handoff retires the source draft receipt while follow-ups await their own canonical echo", async () => {
  const opened: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: { create: async () => created, followup: async () => {} },
      navigation: {
        open: (target) => {
          opened.push(target);
        },
      },
    },
  });
  const action = {
    type: "submit" as const,
    text: "First",
    attachments: [],
    values: { harness: { harnessId: "agent" } },
  };
  expect(await act(ctx, { renderer: { rendererId: "sessions" }, draftKey: "draft", action })).toEqual({
    snapshot: { messages: [], streaming: false },
  });
  expect(opened).toHaveLength(1);
  expect(
    await act(ctx, {
      renderer: { rendererId: "sessions", resource: { type: "session", id: "existing" } },
      draftKey: "existing",
      action,
    }),
  ).toEqual({});
});
