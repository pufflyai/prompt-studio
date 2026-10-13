import type { PanelEdge } from "@pstdio/sdk/extensions";
import {
  allowedGeometryEdges,
  geometryEdge,
  type MovablePanel,
  panelEdges,
  repositionGeometry,
} from "../../registries/layout/panel-geometry";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { saveOpenOwnerLayouts } from "../page-runtime/open-owner-layouts";

export const createPanelGeometry = (resolve: () => WorkbenchCore) => ({
  getPanelEdge(panel: MovablePanel) {
    return geometryEdge(resolve().layout.getLayout(), panel);
  },
  getPanelPositions(panel: MovablePanel) {
    const core = resolve();
    if (!core.shell.getPanelPolicy(panel).movable) return [];
    if (
      (panel === "main" || panel === "secondary") &&
      (!core.shell.getPanelPolicy("main").movable || !core.shell.getPanelPolicy("secondary").movable)
    )
      return [];
    return allowedGeometryEdges(panel);
  },
  repositionPanel(panel: MovablePanel, edge: PanelEdge) {
    const core = resolve();
    if (!core.getPanelPositions(panel).includes(edge)) throw new Error(`Panel ${panel} cannot move to ${edge}`);
    batchWorkbenchChanges(() => {
      core.layout.restoreLayout(repositionGeometry(core.layout.getLayout(), panel, edge));
      saveOpenOwnerLayouts(core);
    });
  },
  setActionBarPosition(edge: PanelEdge) {
    if (!panelEdges.includes(edge)) throw new Error(`Invalid action bar edge: ${edge}`);
    const core = resolve();
    batchWorkbenchChanges(() => {
      core.layout.restoreLayout({ ...core.layout.getLayout(), actionBarEdge: edge });
      saveOpenOwnerLayouts(core);
    });
  },
});
