import { AlertMessage } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useState } from "react";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/lib/sync/collections";
import { buildDashboardWorkspaceOptionsFromRows } from "@/shared/workspaces/workspace-options";
import { createSessionLinkHandler } from "../chat/session-link-handler";

export const useSessionLinks = (workbench: WorkbenchCore, projectId?: string, workspaceId?: string | null) => {
  const [error, setError] = useState<string | null>(null);
  // Messages can render before the workspace syncs. A new row makes a new handler, so paths resolve again.
  const { data } = useLiveQuery(
    (q) =>
      workspaceId
        ? q
            .from({ w: getCollection("workspaces") })
            .where(({ w }) => eq(w.id, workspaceId))
            .select(({ w }) => ({ ...w }))
        : undefined,
    [workspaceId],
  );
  const [workspace] = buildDashboardWorkspaceOptionsFromRows({ workspaces: asSyncedRows(data) ?? [] }, projectId);
  return {
    handler: createSessionLinkHandler({
      workbench,
      projectId,
      workspace,
      origin: window.location.origin,
      onError: setError,
    }),
    notice: error ? (
      <AlertMessage status="error" title="Could not open link" onClose={() => setError(null)}>
        {error}
      </AlertMessage>
    ) : null,
  };
};
