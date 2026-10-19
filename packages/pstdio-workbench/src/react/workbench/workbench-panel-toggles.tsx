import { HStack, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchShellOpenRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchPanelToggles = (workbench: WorkbenchCore) => {
  const sidenav = usePanelPolicy(workbench, "sidenav");
  const secondary = usePanelPolicy(workbench, "secondary");
  const side = usePanelPolicy(workbench, "side");
  const hasNavigation = useWorkbenchRegionContent(workbench, "sidenav");
  const composition = useWorkbenchCompositionPanels(workbench);
  const hasSide = useWorkbenchRegionContent(workbench, "side") || composition.side.addable.length > 0;
  const hasBottom = useWorkbenchRegionContent(workbench, "secondary") || composition.secondary.addable.length > 0;
  const panels = [
    { region: "sidenav", label: "Sidenav", icon: "ListTree", policy: sidenav, provided: hasNavigation },
    { region: "secondary", label: "Bottom Panel", icon: "PanelBottom", policy: secondary, provided: hasBottom },
    { region: "side", label: "Side Panel", icon: "PanelRight", policy: side, provided: hasSide },
  ] as const;
  return panels.filter(
    ({ policy, provided }) => provided && policy.provided && (policy.open ? policy.canClose : policy.canOpen),
  );
};

/** Shared host controls. Desktop hosts mount these beside their project tabs. */
export const WorkbenchPanelToggles = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const panels = useWorkbenchPanelToggles(workbench);
  if (!panels.length) return null;
  return (
    <HStack role="group" aria-label="Panel controls" gap="2xs" flexShrink={0}>
      {panels.map(({ region, label, icon, policy }) => {
        const action = `${policy.open ? "Hide" : "Show"} ${label}`;
        return (
          <Tooltip key={region} content={action}>
            <IconButton
              size={PANEL_HEADER_CONTROL_SIZE}
              variant="ghost"
              aria-label={action}
              aria-pressed={policy.open}
              onClick={() => workbench.shell.setRegionOpen(region as WorkbenchShellOpenRegion, !policy.open)}
            >
              <WorkbenchIcon name={icon} size={14} />
            </IconButton>
          </Tooltip>
        );
      })}
    </HStack>
  );
};
