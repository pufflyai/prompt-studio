import { HStack, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchShellOpenRegion } from "../../core";
import { resolveArrangement } from "../../core/registries/layout/panel-positions";
import { WorkbenchShortcutHint } from "../keybindings/shortcut-hint";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchPanelToggles = (workbench: WorkbenchCore) => {
  const saved = useWorkbenchStore(workbench.layout.store, (state) => state.layout.arrangement);
  const arrangement = resolveArrangement(saved);
  const sidenav = usePanelPolicy(workbench, "sidenav");
  const secondary = usePanelPolicy(workbench, "secondary");
  const side = usePanelPolicy(workbench, "side");
  const hasNavigation = useWorkbenchRegionContent(workbench, "sidenav");
  const composition = useWorkbenchCompositionPanels(workbench);
  const hasSide = useWorkbenchRegionContent(workbench, "side") || composition.side.addable.length > 0;
  const hasBottom = useWorkbenchRegionContent(workbench, "secondary") || composition.secondary.addable.length > 0;
  const panels = [
    { region: "sidenav", label: "Sidenav", icon: "ListTree", policy: sidenav, provided: hasNavigation },
    {
      region: "secondary",
      label: "Bottom Panel",
      icon: arrangement.secondary === "top" ? "PanelTop" : "PanelBottom",
      policy: secondary,
      provided: hasBottom,
    },
    {
      region: "side",
      label: "Side Panel",
      icon: arrangement.side === "left" ? "PanelLeft" : "PanelRight",
      policy: side,
      provided: hasSide,
    },
  ] as const;
  return panels
    .filter(({ policy, provided }) => provided && policy.provided && (policy.open ? policy.canClose : policy.canOpen))
    .map((panel) => ({ ...panel, position: arrangement[panel.region] }));
};

/** Shared host controls. Desktop hosts mount these beside their project tabs. */
export const WorkbenchPanelToggles = (props: {
  workbench: WorkbenchCore;
  regions?: readonly WorkbenchShellOpenRegion[];
}) => {
  const { workbench, regions } = props;
  const panels = useWorkbenchPanelToggles(workbench).filter(({ region }) => !regions || regions.includes(region));
  if (!panels.length) return null;
  return (
    <HStack
      role="group"
      aria-label={regions?.length === 1 && regions[0] === "sidenav" ? "Sidenav controls" : "Panel controls"}
      gap="2xs"
      flexShrink={0}
    >
      {panels.map(({ region, label, icon, policy, position }) => {
        const action = `${policy.open ? "Hide" : "Show"} ${label}`;
        const commandId = region === "sidenav" ? "workbench.toggleSideBar" : `workbench.keyboard.toggle.${region}`;
        return (
          <Tooltip
            key={region}
            content={
              <WorkbenchShortcutHint workbench={workbench} action={{ kind: "command", commandId }}>
                {action}
              </WorkbenchShortcutHint>
            }
          >
            <IconButton
              size={PANEL_HEADER_CONTROL_SIZE}
              variant="ghost"
              aria-label={action}
              aria-pressed={policy.canToggle ? policy.open : undefined}
              onClick={() => workbench.shell.setRegionOpen(region as WorkbenchShellOpenRegion, !policy.open)}
            >
              <WorkbenchIcon
                name={icon}
                size={14}
                layerStyle={region === "sidenav" && position === "right" ? "mirroredIcon" : undefined}
              />
            </IconButton>
          </Tooltip>
        );
      })}
    </HStack>
  );
};
