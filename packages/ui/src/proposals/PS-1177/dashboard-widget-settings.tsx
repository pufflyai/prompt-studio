import { Box, Button, HStack, Icon, IconButton, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { Settings2, Trash2, X } from "lucide-react";
import { useRef } from "react";
import { DisplayMenuSelect } from "@/components/kanban-renderer/display-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { type DashboardWidget, sources, widgetKinds, widgetLabel } from "./dashboard-fixtures";

interface WidgetSettingsProps {
  widget: DashboardWidget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (widget: DashboardWidget) => void;
  onRemove: () => void;
}

export function WidgetSettings(props: WidgetSettingsProps) {
  const { widget, open, onOpenChange, onChange, onRemove } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      initialFocusEl={() => input.current}
      positioning={{ placement: "bottom-end", strategy: "fixed", hideWhenDetached: true }}
      lazyMount
      unmountOnExit
    >
      <Tooltip content="Widget settings">
        <Popover.Trigger asChild>
          <IconButton
            aria-label={`Configure ${widgetLabel(widget)}`}
            data-configure-widget={widget.id}
            size="2xs"
            variant="ghost"
          >
            <Icon as={Settings2} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Widget settings" css={styles.settingsPopover}>
            <HStack p="sm" justify="space-between">
              <Popover.Title asChild>
                <Text textStyle="label/S/medium">Widget settings</Text>
              </Popover.Title>
              <Popover.CloseTrigger asChild>
                <IconButton aria-label="Close widget settings" size="2xs" variant="ghost">
                  <X />
                </IconButton>
              </Popover.CloseTrigger>
            </HStack>
            <ScrollArea flex="1" minH="0">
              <Stack p="md" gap="md">
                <Stack gap="xs">
                  <Text asChild textStyle="label/S/regular">
                    <label htmlFor={`widget-title-${widget.id}`}>Title</label>
                  </Text>
                  <Input
                    ref={input}
                    id={`widget-title-${widget.id}`}
                    value={widget.title}
                    onChange={(event) => onChange({ ...widget, title: event.target.value })}
                  />
                </Stack>
                <Stack gap="2xs">
                  <DisplayMenuSelect
                    label="Type"
                    value={widget.kind}
                    options={widgetKinds.map(({ id, name }) => ({ value: id, label: name }))}
                    onSelect={(kind) => onChange({ ...widget, kind: kind as DashboardWidget["kind"] })}
                  />
                  <DisplayMenuSelect
                    label="Data"
                    value={widget.source}
                    options={sources.map(({ id, name }) => ({ value: id, label: name }))}
                    onSelect={(source) => onChange({ ...widget, source: source as DashboardWidget["source"] })}
                  />
                </Stack>
              </Stack>
            </ScrollArea>
            <Box p="sm" borderTopWidth="1px" borderColor="border.subtle">
              <Button variant="destructive-ghost" onClick={onRemove}>
                <Trash2 />
                Remove widget
              </Button>
            </Box>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
