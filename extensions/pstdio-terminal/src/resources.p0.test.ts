import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { terminals } from "./resources";
import { openTerminal } from "./terminal";

test("terminal search finds an opened tab by its name, identity and workspace", async () => {
  const workspace = {
    id: "selected",
    name: "Feature checkout",
    shorthand: "WS-4",
    projectId: "project",
    executionKind: "local" as const,
    providerState: "ready" as const,
    rootPath: "/workspace",
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      projectId: "project",
      extensionId: "pstdio.pstdio-terminal",
      workspaceId: workspace.id,
      workspaces: { get: async () => workspace, list: async () => [workspace] },
      resources: { allocate: async () => ({ id: "terminal-two", shorthand: "TE-2" }) },
    },
  });
  const resource = await openTerminal.run(ctx, {});
  for (const query of ["Terminal 2", "TE-2", "WS-4", "Feature checkout"]) {
    expect(
      (
        await terminals.query(ctx, {
          query,
          limit: 20,
          providerId: terminals.id,
          renderer: { rendererId: "terminal-search" },
        })
      ).items,
    ).toEqual([
      expect.objectContaining({ id: resource.id, label: "Terminal 2", target: expect.objectContaining({ resource }) }),
    ]);
  }
  expect(
    (
      await terminals.query(ctx, {
        query: "missing",
        limit: 20,
        providerId: terminals.id,
        renderer: { rendererId: "terminal-search" },
      })
    ).items,
  ).toEqual([]);
});
