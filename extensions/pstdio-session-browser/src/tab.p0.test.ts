import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../extension";
import { copySessionNickname } from "./copy-session-nickname";
import { newInViewer } from "./navigation";
import { submitMessage } from "./submit-message";
import { conversationTab } from "./tab";

test("New session in an existing viewer starts a draft immediately with its workspace and device", async () => {
  const opened: unknown[] = [];
  const resource = {
    type: "session",
    id: "previous",
    extensionId: "pstdio",
    device: { id: "laptop", ownerId: "owner", name: "Laptop" },
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource,
      sessions: {
        get: async () =>
          ({ id: "previous", title: "Previous", workspaceId: "workspace", device: resource.device }) as never,
      },
      navigation: { open: (target) => opened.push(target) },
    },
  });
  const snapshot = await conversationTab.query(ctx, { renderer: { rendererId: "conversation", resource } });
  expect(snapshot.tooltip).toBe(await copySessionNickname.run(ctx, { sessionId: resource.id }));
  const action = snapshot.menu?.flatMap((group) => group.rows).find((row) => row.id === "new-session")?.action;
  if (action?.kind !== "command") throw new Error("New session must use the public command contract.");
  const command = extension.commands?.find((command) => command.id === action.target.command.id);
  if (!command) throw new Error("The provider must declare its New session action.");
  // The tab action needs no form; workspace/device come from its captured resource.
  expect(Object.values(command.params ?? {}).filter((param) => param.resolvedFrom !== "resource")).toHaveLength(0);
  expect(action.target.command).toEqual(newInViewer.ref);
  await newInViewer.run(ctx, {});
  expect(opened).toEqual([
    expect.objectContaining({
      kind: "viewer",
      operation: "switch",
      from: resource,
      resource: expect.objectContaining({
        type: "session-draft",
        extensionId: "pstdio",
        metadata: { workspaceId: "workspace", deviceId: "laptop" },
      }),
    }),
  ]);
});

test("a saved tab keeps its nickname when its title changes and it is reopened", async () => {
  const resource = { type: "session", id: "019a6810-f835-7000-8000-000000000001", extensionId: "pstdio" };
  const openTab = (title: string) => {
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: { sessions: { get: async () => ({ id: resource.id, title }) as never } },
    });
    return conversationTab.query(ctx, { renderer: { rendererId: "conversation", resource } });
  };
  expect(await openTab("Original title")).toMatchObject({ label: "Original title", tooltip: "still-eldema" });
  expect(await openTab("Renamed title")).toMatchObject({ label: "Renamed title", tooltip: "still-eldema" });
});

test("a draft gets a nickname only after it becomes a saved session", async () => {
  const id = "019a6810-f835-7000-8000-000000000002";
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { sessions: { get: async () => ({ id, title: "Newly saved session" }) as never } },
  });
  const openTab = (type: string) =>
    conversationTab.query(ctx, { renderer: { rendererId: "conversation", resource: { type, id } } });
  expect((await openTab("session-draft")).tooltip).toBeUndefined();
  expect((await openTab("session")).tooltip).toMatch(/^[a-z]+-[a-z]+$/);
});

test("sending an upgrade draft links the conversation to that review", async () => {
  const create = async (input: unknown) => {
    requests.push(input);
    return { id: "session", title: "Review changes", status: "in_progress" } as never;
  };
  const requests: unknown[] = [];
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, overrides: { sessions: { create } } });
  const id = "0abaa3c9-c145-472d-8e02-88d7bd3e231b";
  const draft = {
    type: "session-draft",
    id: `new-upgrade-${id}-draft`,
    extensionId: "pstdio",
    projectId: ctx.projectId,
    metadata: { upgradeReviewId: id },
  };
  const action = { type: "submit" as const, text: "Review changes", values: {}, attachments: [] };
  await submitMessage(ctx, undefined, draft, action);
  await submitMessage(ctx, undefined, { ...draft, projectId: "other-project" }, action);
  expect(requests).toMatchObject([
    {
      anchors: [
        { type: "extension-upgrade-review", id, extensionId: "pstdio", projectId: ctx.projectId, role: "context" },
      ],
    },
    { anchors: undefined },
  ]);
});

test.each([
  {
    name: "a sparse canonical saved remote session",
    resource: { type: "session", id: "remote", extensionId: "pstdio" },
    session: { id: "remote", workspaceId: "workspace", device: { id: "laptop", ownerId: "owner", name: "Laptop" } },
    deviceId: "laptop",
  },
  {
    name: "a remote draft",
    resource: { type: "session-draft", id: "draft", metadata: { workspaceId: "workspace", deviceId: "laptop" } },
    session: undefined,
    deviceId: "laptop",
  },
  {
    name: "an authoritative local session with a stale remote resource",
    resource: { type: "session", id: "local", device: { id: "old", ownerId: "owner", name: "Old device" } },
    session: { id: "local", workspaceId: "workspace" },
    deviceId: undefined,
  },
])("New session preserves device context for $name", async ({ resource, session, deviceId }) => {
  const opened: Array<{ resource?: { metadata?: Record<string, unknown> } }> = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource,
      sessions: { get: async () => session as never },
      navigation: { open: (target) => opened.push(target as (typeof opened)[number]) },
    },
  });
  await newInViewer.run(ctx, {});
  expect(opened[0]?.resource?.metadata).toEqual({ workspaceId: "workspace", ...(deviceId ? { deviceId } : {}) });
});
