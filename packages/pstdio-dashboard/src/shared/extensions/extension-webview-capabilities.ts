import type { WorkbenchCore, WorkbenchPanelInstance } from "@pstdio/workbench";
import { createWorkbenchWebviewHostAdapters, type ExtensionWebviewHostAdapters } from "@pstdio/workbench/extensions";
import type { NativeDocumentTarget } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { getPerformanceDiagnosticsAdapter } from "@/shared/app/performance-diagnostics";
import { createAccountAdapter } from "./account-capability";
import { createArtifactsReadAdapter } from "./artifact-read-capability";
import { createExtensionFileCapabilities } from "./extension-file-capabilities";
import { createHarnessReadCapability } from "./harness-read-capability";

interface CreateDashboardExtensionWebviewAdaptersInput {
  base: ExtensionWebviewHostAdapters;
  extensionId: string;
  extensionInstanceId?: string;
  projectId?: string;
  webviewId: string;
  textTarget?: NativeDocumentTarget;
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
      ? createWorkbenchWebviewHostAdapters({
          ...input,
          workbench: input.workbench,
          hostEvents: input.base.hostEvents,
          textEditing: getApiClient().textEditing,
        })
      : {}),
    ...input.base,
    performance: input.workbench ? getPerformanceDiagnosticsAdapter(input.workbench.settings) : undefined,
    harnesses: input.projectId ? { read: createHarnessReadCapability(input.projectId) } : undefined,
    account: input.projectId ? createAccountAdapter(input.projectId) : undefined,
    files: owner ? createExtensionFileCapabilities(owner) : undefined,
    artifacts: owner ? { read: createArtifactsReadAdapter({ ...owner, webviewId: input.webviewId }) } : undefined,
  } satisfies ExtensionWebviewHostAdapters;
};
