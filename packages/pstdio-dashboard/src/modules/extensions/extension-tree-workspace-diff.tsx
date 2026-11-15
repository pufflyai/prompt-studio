import { useScopedQueries } from "@pstdio/sdk/extensions/react";
import { useTreeListRowVisibility } from "@pstdio/ui";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { getDashboardWorkspaceDiffQuery } from "@/shared/workspaces/workspace-diff-summary-data";
import { ExtensionTreeWorkspaceDiffStatus } from "./extension-tree-workspace-diff-status";

interface ExtensionTreeWorkspaceDiffProps {
  owner: RuntimeCollections;
  projectId: string;
  workspaceId: string;
}

/** Only an admitted row retains the canonical watch; collapsed and hidden peers release independently. */
export const ExtensionTreeWorkspaceDiff = (props: ExtensionTreeWorkspaceDiffProps) => {
  const { owner, projectId, workspaceId } = props;
  const visible = useTreeListRowVisibility();
  const query = owner.isDisposed() ? undefined : getDashboardWorkspaceDiffQuery(workspaceId, owner, projectId);
  const snapshot = useScopedQueries(query ? [query] : [], visible)[0];
  if (!query || !snapshot || query.isDisposed()) return null;
  const pending = snapshot.fetching || (!snapshot.error && (snapshot.data === undefined || query.inspect().stale));
  return (
    <ExtensionTreeWorkspaceDiffStatus
      workspaceId={workspaceId}
      summary={snapshot.data}
      pending={pending}
      error={snapshot.error}
      onRetry={query.invalidate}
    />
  );
};
