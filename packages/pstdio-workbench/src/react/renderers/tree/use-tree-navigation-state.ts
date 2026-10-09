import type { WorkbenchCore } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { resolveTreeActiveResource } from "./tree-active-resource";

export const useTreeNavigationState = (workbench: WorkbenchCore) => {
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.context.store, (state) => state);
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activeLocation = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) =>
    resolveTreeActiveResource(state.layout, activePage),
  );
  return { projectId, activeLocation, activeResource };
};
