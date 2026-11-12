import { Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { type DashboardWidget, sources, widgetKinds } from "./dashboard-fixtures";

interface WidgetInspectorProps {
  widget: DashboardWidget;
  onChange: (widget: DashboardWidget) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function WidgetInspector(props: WidgetInspectorProps) {
  const { widget, onChange, onRemove, onClose } = props;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const widths = [
    { id: "third", name: "One third" },
    { id: "half", name: "Half" },
    { id: "full", name: "Full" },
  ];
  const heights = [
    { id: "compact", name: "Compact" },
    { id: "standard", name: "Standard" },
    { id: "tall", name: "Tall" },
  ];
  return (
    <Stack h="full" minH="0" gap="0">
      <HStack p="sm" justify="space-between">
        <Text as="h2" textStyle="label/S/medium">
          Widget settings
        </Text>
        <IconButton aria-label="Close widget settings" size="xs" variant="ghost" onClick={onClose}>
          <X />
        </IconButton>
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
              aria-invalid={!widget.title.trim()}
              aria-describedby={!widget.title.trim() ? `widget-error-${widget.id}` : undefined}
              onChange={(event) => onChange({ ...widget, title: event.target.value })}
            />
            {!widget.title.trim() && (
              <Text id={`widget-error-${widget.id}`} textStyle="label/XS/regular" color="fg.error">
                Enter a title.
              </Text>
            )}
          </Stack>
          <Stack gap="xs" role="group" aria-label="Widget type">
            <Text textStyle="label/S/regular">Type</Text>
            <SelectionMenu
              triggerAriaLabel="Widget type"
              triggerLabel={widgetKinds.find(({ id }) => id === widget.kind)?.name}
              options={widgetKinds}
              selectedIds={[widget.kind]}
              multiSelect={false}
              fullWidth
              onToggle={(kind) => onChange({ ...widget, kind: kind as DashboardWidget["kind"] })}
            />
          </Stack>
          <Stack gap="xs" role="group" aria-label="Widget data">
            <Text textStyle="label/S/regular">Data</Text>
            <SelectionMenu
              triggerAriaLabel="Widget data"
              triggerLabel={sources.find(({ id }) => id === widget.source)?.name}
              options={sources}
              selectedIds={[widget.source]}
              multiSelect={false}
              fullWidth
              onToggle={(source) => onChange({ ...widget, source: source as DashboardWidget["source"] })}
            />
          </Stack>
          <Stack gap="xs" role="group" aria-label="Widget width">
            <Text textStyle="label/S/regular">Width</Text>
            <SelectionMenu
              triggerAriaLabel="Widget width"
              triggerLabel={widths.find(({ id }) => id === widget.width)?.name}
              options={widths}
              selectedIds={[widget.width]}
              multiSelect={false}
              fullWidth
              onToggle={(width) => onChange({ ...widget, width: width as DashboardWidget["width"] })}
            />
          </Stack>
          {widget.kind !== "metric" && (
            <Stack gap="xs" role="group" aria-label="Widget height">
              <Text textStyle="label/S/regular">Height</Text>
              <SelectionMenu
                triggerAriaLabel="Widget height"
                triggerLabel={heights.find(({ id }) => id === widget.height)?.name}
                options={heights}
                selectedIds={[widget.height]}
                multiSelect={false}
                fullWidth
                onToggle={(height) => onChange({ ...widget, height: height as DashboardWidget["height"] })}
              />
            </Stack>
          )}
        </Stack>
      </ScrollArea>
      <Box p="sm" borderTopWidth="1px" borderColor="border.subtle">
        <Button variant="destructive-ghost" onClick={onRemove}>
          <Trash2 />
          Remove widget
        </Button>
      </Box>
    </Stack>
  );
}
