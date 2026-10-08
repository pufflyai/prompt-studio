import { AlertMessage } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useState } from "react";
import { createSessionLinkHandler } from "../chat/session-link-handler";

export const useSessionLinks = (workbench: WorkbenchCore, projectId?: string, workspaceId?: string | null) => {
  const [error, setError] = useState<string | null>(null);
  return {
    handler: createSessionLinkHandler({
      workbench,
      projectId,
      workspaceId,
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
