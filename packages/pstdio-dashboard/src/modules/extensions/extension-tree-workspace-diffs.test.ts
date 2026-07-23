import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { withWorkspaceDiffMetadata } from "./extension-tree-workspace-diffs";

const response = {
  commandId: "pstdio-planner.list-ticket-files-tree",
  extensionId: "pstdio.pstdio-planner",
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
} satisfies CommandExecuteResponse;

describe("withWorkspaceDiffMetadata", () => {
  test("adds diff metadata to workspace resource targets in extension tree responses", async () => {
    const decorated = await withWorkspaceDiffMetadata(response, async (workspaceId) => ({
      workspaceId,
      additions: 7,
      deletions: 2,
      fileCount: 3,
    }));

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
