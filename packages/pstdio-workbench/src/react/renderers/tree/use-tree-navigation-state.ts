import type { WorkbenchCore } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { visibleResourceKeys } from "../../shared/visible-resources";
import { resolveTreeActiveResource } from "./tree-active-resource";

export const useTreeNavigationState = (workbench: WorkbenchCore) => {
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activeLocation = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) =>
    resolveTreeActiveResource(state.layout, activePage, activeLocation?.resource),
  );
  useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  const visible = useWorkbenchStore(workbench.layout.store, () => visibleResourceKeys(workbench).join("\0"));
  return { projectId, activeLocation, activeResource, visibleResources: new Set(visible ? visible.split("\0") : []) };
};
