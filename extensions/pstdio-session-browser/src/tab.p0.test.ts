import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../extension";
import { newInViewer } from "./navigation";
import { conversationTab } from "./tab";

test("a conversation that has not started shows Pending in its tab", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const tab = await conversationTab.query(ctx, {
    renderer: { rendererId: "conversation", resource: { type: "session-draft", id: "new" } },
  });
  expect(tab.indicator).toMatchObject({ icon: "circle-dashed", color: "fg.muted", label: "Session status: pending" });
});

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
