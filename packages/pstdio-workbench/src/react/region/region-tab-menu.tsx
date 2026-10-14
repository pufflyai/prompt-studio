import { Menu, Portal } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

const TabAction = (props: { value: string; label: string; icon: string; onActivate(): void }) => {
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
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}

export const RegionTabMenu = (props: RegionTabMenuProps) => {
  const { anchor, label, open, setOpen, placement, workbench } = props;
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
            {placement.tabRetention ? (
              <TabAction
                value="pin"
                label={placement.tabRetention === "preview" ? "Pin tab" : "Unpin tab"}
                icon={placement.tabRetention === "preview" ? "pin" : "pin-off"}
                onActivate={pin}
              />
            ) : null}
            {placement.closable ? <TabAction value="close" label="Close tab" icon="x" onActivate={close} /> : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
