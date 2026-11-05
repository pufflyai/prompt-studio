import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { sessionBrowser } from "../refs";
import { create, open } from "./navigation";

test("new drafts keep explicit and contextual workspace, harness and device identity", async () => {
  const opened: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: {
        type: "workspace",
        id: "workspace",
        device: { id: "laptop", ownerId: "owner", name: "Laptop" },
      },
      navigation: { open: (target) => opened.push(target) },
    },
  });
  await create.run(ctx, { harnessId: "remote-agent", side: true });
  expect(opened[0]).toMatchObject({
    kind: "panel",
    panel: sessionBrowser.panels.conversation,
    open: "pin",
    resource: {
      type: "session-draft",
      extensionId: "pstdio",
      metadata: { workspaceId: "workspace", agent: "remote-agent", deviceId: "laptop" },
    },
  });
});

test("opening a saved conversation into its invoking viewer preserves page and panel context", async () => {
  const opened: unknown[] = [];
  const from = { type: "session", id: "previous", extensionId: "pstdio" };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: from,
      sessions: { get: async () => ({ id: "next", title: "Next", status: "completed" }) as never },
      navigation: { open: (target) => opened.push(target) },
    },
  });
  await open.run(ctx, { sessionId: "next", replace: true });
  expect(opened[0]).toMatchObject({
    kind: "viewer",
    operation: "switch",
    from,
    page: sessionBrowser.pages.session,
    resource: { id: "next", extensionId: "pstdio" },
  });
});
