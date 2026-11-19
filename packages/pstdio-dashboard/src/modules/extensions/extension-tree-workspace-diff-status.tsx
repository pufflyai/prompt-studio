import { Button, HStack, Spinner } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import { TriangleAlert } from "lucide-react";
import type { DashboardWorkspaceDiffSummary } from "@/shared/workspaces/workspace-diff-summary-data";

interface WorkspaceDiffStatusProps {
  workspaceId: string;
  summary?: DashboardWorkspaceDiffSummary | null;
  pending: boolean;
  error?: Error;
  onRetry(): void;
}

export const ExtensionTreeWorkspaceDiffStatus = (props: WorkspaceDiffStatusProps) => {
  const { workspaceId, summary, pending, error, onRetry } = props;
  let state = error ? "error" : "ready";
  if (pending) state = "pending";
  return (
    <HStack
      as="span"
      gap="xs"
      data-workspace-diff-id={workspaceId}
      data-workspace-diff-state={state}
      aria-busy={pending}
    >
      {summary ? (
        <DiffBubble additions={summary.additions} deletions={summary.deletions} variant="ghost" size="small" />
      ) : null}
      {pending ? <Spinner size="xs" aria-label="Loading workspace changes" /> : null}
      {error ? (
        <Tooltip content="Workspace changes unavailable">
          <Button
            size="xs"
            variant="ghost"
            colorPalette="red"
            aria-label="Retry workspace changes"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
          >
            <TriangleAlert />
            Retry
          </Button>
        </Tooltip>
      ) : null}
    </HStack>
  );
};
