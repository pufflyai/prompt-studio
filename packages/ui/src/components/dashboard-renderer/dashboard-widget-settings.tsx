import { Box, Button, Icon, IconButton, Input, Stack, Text, Textarea, useSlotRecipe } from "@chakra-ui/react";
import { Settings2, Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { DisplayMenuSelect } from "@/components/kanban-renderer/display-menu";
import { PopoverHeader } from "@/components/overlays/popover-header";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import {
  type DashboardDataSource,
  type DashboardWidget,
  sourcesForKind,
  widgetKinds,
  widgetLabel,
} from "./dashboard-types";
import { WidgetColors } from "./dashboard-widget-colors";

interface WidgetSettingsProps {
  widget: DashboardWidget;
  sources: DashboardDataSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (widget: DashboardWidget) => void;
  onRemove: () => void;
}

export function WidgetSettings(props: WidgetSettingsProps) {
  const { widget, sources, open, onOpenChange, onChange, onRemove } = props;
  const titleId = useId();
  const descriptionId = useId();
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const input = useRef<HTMLInputElement>(null);
  const source = sources.find(({ id }) => id === widget.source);
  const availableSources = sourcesForKind(sources, widget.kind);
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
            aria-label={`Configure ${widgetLabel(widget, source?.name)}`}
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
            <PopoverHeader icon={<Icon as={Settings2} />} title={<Popover.Title>Widget settings</Popover.Title>} />
            <ScrollArea flex="1" minH="0">
              <Stack p="md" gap="md">
                <Stack gap="xs">
                  <Text asChild textStyle="label/S/regular">
                    <label htmlFor={titleId}>Title</label>
                  </Text>
                  <Input
                    ref={input}
                    id={titleId}
                    value={widget.title}
                    placeholder={widget.kind === "custom" ? source?.name : undefined}
                    onChange={(event) => onChange({ ...widget, title: event.target.value })}
                  />
                </Stack>
                <Stack gap="xs">
                  <Text asChild textStyle="label/S/regular">
                    <label htmlFor={descriptionId}>Description</label>
                  </Text>
                  <Textarea
                    id={descriptionId}
                    rows={2}
                    value={
                      widget.description ?? (widget.kind === "metric" ? source?.metric?.description : undefined) ?? ""
                    }
                    onChange={(event) => onChange({ ...widget, description: event.target.value })}
                  />
                </Stack>
                <Stack gap="2xs">
                  <DisplayMenuSelect
                    label="Type"
                    value={widget.kind}
                    options={widgetKinds
                      .filter(({ id }) => id === widget.kind || sourcesForKind(sources, id).length > 0)
                      .map(({ id, name }) => ({ value: id, label: name }))}
                    onSelect={(value) => {
                      const kind = value as DashboardWidget["kind"];
                      const options = sourcesForKind(sources, kind);
                      const next = options.find(({ id }) => id === widget.source) ?? options[0];
                      if (next) onChange({ ...widget, kind, source: next.id });
                    }}
                  />
                  <DisplayMenuSelect
                    label="Data"
                    value={widget.source}
                    disabled={!availableSources.some(({ id }) => id !== widget.source)}
                    options={availableSources.map(({ id, name }) => ({ value: id, label: name }))}
                    onSelect={(id) => {
                      if (id === widget.source) return;
                      const next = availableSources.find(({ id: sourceId }) => sourceId === id);
                      const defaults = source?.customWidgetDefaults;
                      const nextDefaults = next?.customWidgetDefaults;
                      if (widget.kind !== "custom" || (!defaults && !nextDefaults)) {
                        onChange({ ...widget, source: id });
                        return;
                      }
                      onChange({
                        ...widget,
                        source: id,
                        title: widget.title === (defaults?.title ?? "") ? (nextDefaults?.title ?? "") : widget.title,
                        description:
                          widget.description === defaults?.description ? nextDefaults?.description : widget.description,
                      });
                    }}
                  />
                </Stack>
                <WidgetColors
                  key={`${widget.kind}:${widget.source}`}
                  widget={widget}
                  source={source}
                  onChange={onChange}
                />
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
