import { useWorkspaceDiff } from "../api/use-workspace-diff";
import type { WorkspaceTabComponentProps } from "../contract";
import { transformFileDiffs } from "../utils/transform-diff";
import { WorkspaceChangesPanel } from "./workspace-changes-panel";

export const WorkspaceChangesTab = (props: WorkspaceTabComponentProps) => {
  const { workspaceId } = props;
  const diffQuery = useWorkspaceDiff(workspaceId);
  const diffData = diffQuery.data;
  const isLoading = Boolean(workspaceId) && (diffQuery.isPending || (diffQuery.isFetching && !diffData));
  const changedFiles = diffData?.files ?? [];
  const diffs = diffData?.files ? transformFileDiffs(diffData.files) : [];

  return <WorkspaceChangesPanel diffs={diffs} changedFiles={changedFiles} loading={isLoading} />;
};
