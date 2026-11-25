import { HStack, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { useState } from "react";
import { DisplayMenuSelect } from "@/components/kanban-renderer/display-menu";
import { SelectionMenu, selectionOptionIcon } from "@/components/param-editor/inputs/selection-menu";
import { dashboardColorOptions, widgetColorSettings } from "./dashboard-colors";
import type { DashboardDataSource, DashboardWidget, DashboardWidgetColor } from "./dashboard-types";

interface WidgetColorsProps {
  widget: DashboardWidget;
  source?: DashboardDataSource;
  onChange: (widget: DashboardWidget) => void;
}

export function WidgetColors(props: WidgetColorsProps) {
  const { widget, source, onChange } = props;
  const [selectedKey, setSelectedKey] = useState("");
  const settings = widgetColorSettings(widget, source);
  if (!settings) return null;
  const { series, label } = settings;
  const key = series?.keys.find((id) => id === selectedKey) ?? series?.keys[0];
  if (series && key === undefined) return null;
  const selected = key === undefined ? widget.color : widget.seriesColors?.[key];
  const option = dashboardColorOptions.find(({ id }) => id === selected) ?? dashboardColorOptions[0];
  return (
    <Stack gap="xs">
      {series && key !== undefined && (
        <DisplayMenuSelect
          label={series.label}
          value={key}
          options={series.keys.map((key) => ({ value: key, label: series.names?.[key] ?? key }))}
          onSelect={setSelectedKey}
        />
      )}
      <HStack justify="space-between" gap="xs">
        <Text textStyle="label/S/regular">{label}</Text>
        <SelectionMenu
          size="xs"
          triggerAriaLabel={label}
          triggerLabel={
            <>
              <VisuallyHidden>{label}: </VisuallyHidden>
              {selectionOptionIcon(option, "3")}
              {option.name}
            </>
          }
          selectedIds={[option.id]}
          options={dashboardColorOptions}
          multiSelect={false}
          onToggle={(id) => {
            const color = id === "default" ? undefined : (id as DashboardWidgetColor);
            if (key === undefined) {
              onChange({ ...widget, color });
              return;
            }
            const seriesColors = { ...widget.seriesColors };
            delete seriesColors[key];
            onChange({ ...widget, seriesColors: color ? { ...seriesColors, [key]: color } : seriesColors });
          }}
        />
      </HStack>
    </Stack>
  );
}
