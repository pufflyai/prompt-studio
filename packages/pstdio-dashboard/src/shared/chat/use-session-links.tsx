import { AlertMessage } from "@pstdio/ui";
import type { ChatLinkHandler } from "@pstdio/ui/chat-ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import type { NativeChatHostProps } from "@pstdio/workbench/extensions";
import { useState } from "react";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/lib/sync/collections";
import { buildDashboardWorkspaceOptionsFromRows } from "@/shared/workspaces/workspace-options";
import { composeNativeChatLinks } from "./native-chat-links";
import { createSessionLinkHandler } from "./session-link-handler";

export const useSessionLinks = (
  workbench: WorkbenchCore,
  projectId: string | undefined,
  workspaceId: string | null | undefined,
  provider: ChatLinkHandler | undefined,
  source?: Pick<NativeChatHostProps, "sourceRegion" | "sourcePlacement">,
) => {
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
  const host = createSessionLinkHandler({
    workbench,
    projectId,
    workspace,
    origin: window.location.origin,
    ...source,
    onError: setError,
  });
  return {
    handler: composeNativeChatLinks(provider, host),
    notice: error ? (
      <AlertMessage status="error" title="Could not open link" onClose={() => setError(null)}>
        {error}
      </AlertMessage>
    ) : null,
  };
};
