import { Box, Menu, Portal } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { runUserAction } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import { WorkbenchIcon } from "../shared/icon";
import { getPanelLabel } from "./panel-widget-open";

const activate = (workbench: WorkbenchCore, action: NonNullable<WorkbenchTabMenuGroup["rows"][number]["action"]>) => {
  const target = action.kind === "navigation" ? action.target : action;
  if (target.kind === "command") {
    const command = workbench.commands.getCommand(target.commandId)?.command;
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({
        record: { command },
        label: command.label,
        args: target.args,
      });
    } else
      void runUserAction(workbench, command?.label ?? "Command", () =>
        workbench.commands.executeCommand(target.commandId, target.args),
      );
  } else void runUserAction(workbench, "Open", () => workbench.navigation.openTarget(target));
};
const SharedAction = (props: { value: string; label: string; icon: string; onActivate(): void }) => {
  const { value, label, icon, onActivate } = props;
  return (
    <Menu.Item value={value} asChild>
      <ListRow
        asChild
        variant="full-width"
        id={value}
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
                        id={row.id}
                        label={row.label}
                        icon={row.icon ? <WorkbenchIcon name={row.icon} size={14} /> : undefined}
                        iconColor={row.iconColor}
                        isSelected={row.selected}
                        disabled={row.disabled}
                        onActivate={row.action ? () => activate(workbench, row.action!) : undefined}
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
