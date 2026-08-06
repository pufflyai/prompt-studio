import type { WorkbenchLayout, WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { registerExtensionContributions } from "./extension-contribution-registration";
import type { ExtensionLayoutPersistence } from "./extension-layout-persistence";
import {
  type ExtensionLayoutCompatibility,
  reconcileExtensionLayout,
  resetExtensionLayout,
} from "./extension-layout-reconciliation";

export const reconcileExtensionRefreshLayout = (input: {
  activeLayoutScope: string | undefined;
  current: ExtensionLayoutCompatibility;
  layout: WorkbenchLayout;
  layoutPersistence: ExtensionLayoutPersistence | undefined;
  previous: ExtensionLayoutCompatibility | undefined;
  projectId: string;
  resets: Array<{ extensionId: string; modeId?: string; revision: string }>;
}) => {
  const previous = input.layoutPersistence?.reconcile(input.projectId, input.current).previous ?? input.previous;
  const appliedResets = input.layoutPersistence?.applyResets(input.projectId, input.current, input.resets) ?? [];
  const reconciled = reconcileExtensionLayout({ current: input.current, layout: input.layout, previous });

  return appliedResets
    .filter(
      (reset) =>
        !reset.modeId ||
        input.activeLayoutScope?.startsWith(`project/${input.projectId}/mode/${reset.modeId}/`) === true,
    )
    .reduce((layout, reset) => resetExtensionLayout(layout, input.current, reset.extensionId), reconciled);
};

export const registerCurrentExtensionContributions = (input: {
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) =>
  registerExtensionContributions({
    ...input,
    onRegistrationError: (error, extensionId) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[dashboard.extensions:${extensionId}] contribution registration failed: ${message}`);
    },
  });
