import { Box, Menu, Portal } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useRef } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import type { WorkbenchCommandParamsRequest } from "../../core/controllers/command-palette/command-palette-controller";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { WorkbenchIcon } from "../shared/icon";
import { runPlacementAction } from "../shared/run-placement-action";
import { getPanelLabel } from "./panel-widget-open";

const SharedAction = (props: { value: string; label: string; icon: string; onActivate(): void }) => {
  const { value, label, icon, onActivate } = props;
  return (
    <Menu.Item value={value} asChild>
      <ListRow
        asChild
        variant="full-width"
        label={label}
        icon={<WorkbenchIcon name={icon} size={14} />}
        onActivate={onActivate}
      />
    </Menu.Item>
  );
};
interface RegionTabMenuProps {
  anchor: { x: number; y: number; width: number; height: number };
  label: string;
  open: boolean;
  setOpen(open: boolean): void;
  groups: readonly WorkbenchTabMenuGroup[];
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}
export const RegionTabMenu = (props: RegionTabMenuProps) => {
  const { anchor, label, open, setOpen, groups, placement, workbench } = props;
  const pendingRequest = useRef<WorkbenchCommandParamsRequest | null>(null);
  const currentRegion = findPlacementByWidgetId(workbench.layout.getLayout(), placement.widgetId)?.regionId;
  const destinations = workbench.getPanelDestinations(placement.widgetId).filter((region) => region !== currentRegion);
  const pin = () => {
    const pinned = placement.tabRetention === "preview";
    if (placement.placementIdentity) workbench.pinPlacement(placement.placementIdentity, pinned);
    else workbench.layout.updatePanel(placement.widgetId, { strategy: { kind: pinned ? "persistent" : "preview" } });
  };
  const close = () => {
    if (placement.placementIdentity) workbench.closePlacement(placement.placementIdentity);
    else workbench.layout.closePanel(placement.widgetId);
  };
  return (
    <Menu.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      onExitComplete={() => {
        const request = pendingRequest.current;
        pendingRequest.current = null;
        // Finish the menu's focus restoration before opening a dialog.
        if (request) workbench.commandPalette.requestParams(request);
      }}
      positioning={{ placement: "bottom-start", getAnchorRect: () => anchor, offset: { mainAxis: 0 } }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={`${label} context menu`} minW="64" bg="bg">
            {groups
              .filter((group) => group.rows.length)
              .map((group, index) => (
                <Box key={group.id} display="contents">
                  {index > 0 ? <Menu.Separator /> : null}
                  {group.rows.map((row) => (
                    <Menu.Item key={row.id} value={row.id} disabled={row.disabled} asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        label={row.label}
                        icon={row.icon ? <WorkbenchIcon name={row.icon} size={14} /> : undefined}
                        iconColor={row.iconColor}
                        isSelected={row.selected}
                        disabled={row.disabled}
                        onActivate={
                          row.action
                            ? () => {
                                runPlacementAction(workbench, row.action!, (request) => {
                                  pendingRequest.current = request;
                                });
                              }
                            : undefined
                        }
                      />
                    </Menu.Item>
                  ))}
                </Box>
              ))}
            {groups.some((group) => group.rows.length) ? <Menu.Separator /> : null}
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Tab</Menu.ItemGroupLabel>
              {placement.tabRetention ? (
                <SharedAction
                  value="pin"
                  label={placement.tabRetention === "preview" ? "Pin tab" : "Unpin tab"}
                  icon="pin"
                  onActivate={pin}
                />
              ) : null}
              {destinations.map((region) => (
                <SharedAction
                  key={region}
                  value={`move-${region}`}
                  label={`Move to ${getPanelLabel(region)}`}
                  icon="ArrowRight"
                  onActivate={() => workbench.movePanel(placement.widgetId, region)}
                />
              ))}
              {placement.closable ? <SharedAction value="close" label="Close tab" icon="x" onActivate={close} /> : null}
              <SharedAction
                value="reset-layout"
                label="Reset layout"
                icon="RotateCcw"
                onActivate={() => workbench.resetLayout()}
              />
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
