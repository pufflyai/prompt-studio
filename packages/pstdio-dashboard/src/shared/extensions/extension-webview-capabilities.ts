import type { WorkbenchCore, WorkbenchPanelInstance } from "@pstdio/workbench";
import { createWorkbenchWebviewHostAdapters, type ExtensionWebviewHostAdapters } from "@pstdio/workbench/extensions";
import { createArtifactsReadAdapter } from "./artifact-read-capability";
import { createExtensionFileCapabilities } from "./extension-file-capabilities";

interface CreateDashboardExtensionWebviewAdaptersInput {
  base: ExtensionWebviewHostAdapters;
  extensionId: string;
  extensionInstanceId?: string;
  projectId?: string;
  webviewId: string;
  workbench?: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  ownedPreferences?: Parameters<typeof createWorkbenchWebviewHostAdapters>[0]["ownedPreferences"];
}

export const createDashboardExtensionWebviewAdapters = (input: CreateDashboardExtensionWebviewAdaptersInput) => {
  const owner =
    input.projectId && input.extensionInstanceId
      ? { projectId: input.projectId, extensionInstanceId: input.extensionInstanceId }
      : undefined;
  return {
    ...(input.workbench
      ? createWorkbenchWebviewHostAdapters({ ...input, workbench: input.workbench, hostEvents: input.base.hostEvents })
      : {}),
    ...input.base,
    files: owner ? createExtensionFileCapabilities(owner) : undefined,
    artifacts: owner ? { read: createArtifactsReadAdapter({ ...owner, webviewId: input.webviewId }) } : undefined,
  } satisfies ExtensionWebviewHostAdapters;
};
