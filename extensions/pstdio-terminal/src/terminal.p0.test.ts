import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { openTerminal, openWorkspaceTerminal, terminal, terminalPlacement } from "./terminal";

const fixture = () => {
  const workspaces = [
    {
      id: "root",
      isDefault: true,
      providerState: "ready" as const,
      executionKind: "local" as const,
      rootPath: "/project",
    },
    { id: "selected", providerState: "ready" as const, executionKind: "local" as const, rootPath: "/workspace" },
    { id: "remote", providerState: "ready" as const, executionKind: "remote" as const },
  ];
  const opened: unknown[] = [];
  let next = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      projectId: "project",
      extensionId: "pstdio.pstdio-terminal",
      workspaces: {
        getDefault: async () => workspaces[0]!,
        get: async (id) => workspaces.find((workspace) => workspace.id === id) ?? null,
      },
      resources: { allocate: async () => ({ id: `terminal-${++next}`, shorthand: `TE-${next}` }) },
      navigation: {
        open: (target) => {
          opened.push(target);
        },
      },
    },
  });
  return { ctx, opened };
};

test("Open terminal chooses the selected ready workspace and opens distinct named native tabs", async () => {
  const { ctx, opened } = fixture();
  ctx.resource = { type: "workspace", id: "selected", projectId: "project" };
  await openTerminal.run(ctx, {});
  await openTerminal.run(ctx, {});
  expect(opened).toMatchObject([
    {
      kind: "panel",
      panel: terminalPlacement.ref,
      open: "pin",
      resource: { id: "terminal-1", label: "Terminal 1", metadata: { workspaceId: "selected" } },
    },
    {
      kind: "panel",
      panel: terminalPlacement.ref,
      open: "pin",
      resource: { id: "terminal-2", label: "Terminal 2", metadata: { workspaceId: "selected" } },
    },
  ]);
});

test("the default terminal starts in the project folder and validates the backing again when opening its session", async () => {
  const { ctx, opened } = fixture();
  await openTerminal.run(ctx, {});
  const target = opened[0] as { resource: { metadata: { workspaceId: string } } };
  expect(target.resource.metadata.workspaceId).toBe("root");
  expect(
    await terminal.body.session(ctx, {
      renderer: {
        rendererId: "terminal",
        resource: { type: "terminal", id: "one", metadata: { workspaceId: "selected" } },
      },
    }),
  ).toEqual({ workspaceId: "selected" });
  ctx.workspaces.get = async () => ({
    id: "selected",
    executionKind: "local",
    providerState: "provider_missing",
    rootPath: "/workspace",
  });
  await expect(
    terminal.body.session(ctx, {
      renderer: {
        rendererId: "terminal",
        resource: { type: "terminal", id: "one", metadata: { workspaceId: "selected" } },
      },
    }),
  ).rejects.toThrow("ready local workspace");
});

test("terminal commands reject remote, missing and foreign-project targets", async () => {
  const { ctx, opened } = fixture();
  await expect(openWorkspaceTerminal.run(ctx, { workspaceId: "remote" })).rejects.toThrow("ready local workspace");
  await expect(openWorkspaceTerminal.run(ctx, { workspaceId: "missing" })).rejects.toThrow("ready local workspace");
  ctx.resource = { type: "workspace", id: "selected", projectId: "foreign" };
  await expect(openTerminal.run(ctx, {})).rejects.toThrow("another project");
  expect(opened).toEqual([]);
});
