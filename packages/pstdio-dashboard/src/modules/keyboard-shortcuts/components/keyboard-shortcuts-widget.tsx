import {
  useWorkbenchStore,
  WorkbenchKeyboardShortcutsPanel,
  type WorkbenchPanelRenderInput,
} from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import {
  getCachedDashboardExtensionMetadata,
  subscribeDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
export const KeyboardShortcutsWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = useWorkbenchStore(input.workbench.pages.store, (state) => state.projectId);
  const metadata = useSyncExternalStore(subscribeDashboardExtensionMetadata, () =>
    getCachedDashboardExtensionMetadata(projectId),
  );
  const ownerLabels = Object.fromEntries(
    (metadata?.extensions ?? []).map((extension) => [extension.id, extension.displayName || extension.name]),
  );
  return (
    <WorkbenchKeyboardShortcutsPanel
      workbench={input.workbench}
      ownerLabels={ownerLabels}
      initialFilter={input.instance.resource?.metadata?.extensionId as string | undefined}
    />
  );
};
