import { Button, HStack, Stack } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { TreeList } from "@pstdio/ui";
import { useState } from "react";
import { ExtensionTreeWorkspaceDiffStatus } from "./extension-tree-workspace-diff-status";

export default {
  title: "Product/Workbench/Trees/Workspace changes",
  description: "Synthetic native row loading, accepted totals, empty values, failed refresh and retry.",
} satisfies CanvasMeta;

export const Changes = () => {
  const [state, setState] = useState("ready");
  const summary = { workspaceId: "workspace", additions: 7, deletions: 2, fileCount: 1 };
  const pending = ["pending", "refresh", "retry", "retry-refresh"].includes(state);
  const error = ["error", "failed-refresh", "retry", "retry-refresh"].includes(state)
    ? new Error("Changes unavailable")
    : undefined;
  const retained = ["ready", "refresh", "failed-refresh", "retry-refresh"].includes(state);
  return (
    <Stack>
      <HStack wrap="wrap">
        {["pending", "ready", "empty", "error", "refresh", "failed-refresh"].map((value) => (
          <Button key={value} size="xs" variant="outline" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <TreeList
        expandedSectionIds={["workspaces"]}
        sections={[
          {
            id: "workspaces",
            label: "Workspaces",
            nodes: [
              {
                id: "workspace",
                label: "WS-1",
                endContent: (
                  <ExtensionTreeWorkspaceDiffStatus
                    workspaceId="workspace"
                    summary={retained ? summary : undefined}
                    pending={pending}
                    error={error}
                    onRetry={() => setState(retained ? "retry-refresh" : "retry")}
                  />
                ),
              },
            ],
          },
        ]}
      />
    </Stack>
  );
};
