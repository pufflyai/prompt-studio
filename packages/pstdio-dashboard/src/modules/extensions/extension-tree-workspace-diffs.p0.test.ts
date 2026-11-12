import { describe, expect, test } from "bun:test";
import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { withWorkspaceDiffMetadata } from "./extension-tree-workspace-diffs";

const response = {
  commandId: "pstdio-planner.list-ticket-files-tree",
  extensionId: "pstdio.planner",
  outcome: {
    ok: true,
    status: "success",
    value: [
      {
        id: "workspaces",
        nodes: [
          {
            id: "workspace-ws-1",
            label: "WS-1",
            target: {
              kind: "resource",
              resource: {
                type: "workspace",
                id: "ws-1",
                label: "WS-1",
                metadata: {
                  resourceParent: {
                    type: "ticket",
                    id: "ticket-1",
                    label: "PS-1 Ticket",
                    metadata: { shorthand: "PS-1" },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  },
} satisfies CommandExecutionResult;

describe("withWorkspaceDiffMetadata", () => {
  test("loads each workspace once in bounded batches before decorating the complete tree", async () => {
    const nodes = Array.from({ length: 5 }, (_, index) => ({
      id: `workspace-${index}`,
      resource: { type: "workspace", id: `ws-${index}` },
      target: { kind: "resource", resource: { type: "workspace", id: `ws-${index}` } },
    }));
    const tree = { ...response, outcome: { ...response.outcome, value: [{ id: "workspaces", nodes }] } };
    const gate = Promise.withResolvers<void>();
    const requested: string[] = [];
    let active = 0;
    let peak = 0;
    const pending = withWorkspaceDiffMetadata(tree, async (workspaceId) => {
      requested.push(workspaceId);
      peak = Math.max(peak, ++active);
      await gate.promise;
      active--;
      return { workspaceId, additions: 7, deletions: 2, fileCount: 3 };
    });
    await Promise.resolve();
    await Promise.resolve();
    const firstBatch = [...requested];
    gate.resolve();
    const decorated = await pending;
    expect(firstBatch).toEqual(["ws-0", "ws-1", "ws-2", "ws-3"]);
    expect(peak).toBe(4);
    expect(requested).toEqual(["ws-0", "ws-1", "ws-2", "ws-3", "ws-4"]);
    expect(active).toBe(0);
    if (!decorated.outcome.ok) throw new Error(decorated.outcome.reason);
    expect(decorated.outcome.value).toEqual([
      {
        id: "workspaces",
        nodes: nodes.map((node) => ({
          ...node,
          resource: {
            ...node.resource,
            metadata: { diffOverview: "+7 -2", diffAdditions: 7, diffDeletions: 2, diffFileCount: 3 },
          },
          target: {
            ...node.target,
            resource: {
              ...node.target.resource,
              metadata: { diffOverview: "+7 -2", diffAdditions: 7, diffDeletions: 2, diffFileCount: 3 },
            },
          },
        })),
      },
    ]);
    expect(tree.outcome.value).toEqual([{ id: "workspaces", nodes }]);
  });

  test("adds diff metadata to workspace resource targets in extension tree responses", async () => {
    const decorated = await withWorkspaceDiffMetadata(response, async (workspaceId) => ({
      workspaceId,
      additions: 7,
      deletions: 2,
      fileCount: 3,
    }));

    if (!decorated.outcome.ok) throw new Error(decorated.outcome.reason);
    expect(decorated.outcome.value).toMatchObject([
      {
        nodes: [
          {
            target: {
              resource: {
                metadata: {
                  resourceParent: {
                    type: "ticket",
                    id: "ticket-1",
                    label: "PS-1 Ticket",
                    metadata: { shorthand: "PS-1" },
                  },
                  diffOverview: "+7 -2",
                  diffAdditions: 7,
                  diffDeletions: 2,
                  diffFileCount: 3,
                },
              },
            },
          },
        ],
      },
    ]);
  });
});
