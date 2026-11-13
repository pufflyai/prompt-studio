import { Icon, IconButton, Text, useSlotRecipe } from "@chakra-ui/react";
import { Settings2 } from "lucide-react";
import { DisplayMenuSelect } from "@/components/kanban-renderer/display-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { type DashboardLayoutMode, layoutModes } from "./dashboard-types";

interface DashboardDisplaySettingsProps {
  mode: DashboardLayoutMode;
  onModeChange: (mode: DashboardLayoutMode) => void;
  disabled?: boolean;
}

export function DashboardDisplaySettings(props: DashboardDisplaySettingsProps) {
  const { mode, onModeChange, disabled } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  return (
    <Popover.Root
      positioning={{ placement: "bottom-end", strategy: "fixed", hideWhenDetached: true }}
      lazyMount
      unmountOnExit
    >
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton aria-label="Display settings" variant="ghost" size="2xs" disabled={disabled}>
            <Icon as={Settings2} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Dashboard display settings" css={styles.settingsPopover} p="2xs">
            <Popover.Title asChild>
              <Text px="xs" pt="xs" pb="2xs" textStyle="label/XS/medium" color="fg.muted">
                DASHBOARD DISPLAY
              </Text>
            </Popover.Title>
            <DisplayMenuSelect
              label="Layout"
              value={mode}
              options={layoutModes.map(({ id, name }) => ({ value: id, label: name }))}
              onSelect={(value) => onModeChange(value as DashboardLayoutMode)}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
