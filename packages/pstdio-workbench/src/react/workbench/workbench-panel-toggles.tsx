import { HStack, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolvePanelToggles } from "../../core/controllers/shell/panel-toggles";
import { runUserAction } from "../../core/shared/run-user-action";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchPanelToggles = (workbench: WorkbenchCore) => {
  const sidenav = usePanelPolicy(workbench, "sidenav");
  const secondary = usePanelPolicy(workbench, "secondary");
  const side = usePanelPolicy(workbench, "side");
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const hasNavigation = useWorkbenchRegionContent(workbench, "sidenav");
  return resolvePanelToggles({
    edges: {
      sidenav: workbench.getPanelEdge("sidenav"),
      side: workbench.getPanelEdge("side"),
      secondary: workbench.getPanelEdge("secondary"),
    },
    policies: { sidenav: { ...sidenav, provided: sidenav.provided && hasNavigation }, secondary, side },
  });
};

/** Host-owned controls shared by the web status bar and desktop title bar. */
export const WorkbenchPanelToggles = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const toggles = useWorkbenchPanelToggles(workbench);
  if (!toggles.length) return null;
  return (
    <HStack role="group" aria-label="Panel toggles" data-workbench-panel-toggles="" gap="2xs" flexShrink={0}>
      {toggles.map((toggle) => (
        <Tooltip key={toggle.region} content={toggle.label} openDelay={300} closeDelay={150}>
          <IconButton
            size={PANEL_HEADER_CONTROL_SIZE}
            variant="ghost"
            aria-label={toggle.label}
            aria-pressed={toggle.open}
            onClick={() =>
              void runUserAction(workbench, toggle.label, () =>
                workbench.shell.setRegionOpen(toggle.region, !toggle.open),
              )
            }
          >
            <WorkbenchIcon name={toggle.icon} size={14} />
          </IconButton>
        </Tooltip>
      ))}
    </HStack>
  );
};
