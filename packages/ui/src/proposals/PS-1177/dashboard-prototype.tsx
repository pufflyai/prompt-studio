import { Box, Button, HStack, Stack, Text, useSlotRecipe, VisuallyHidden } from "@chakra-ui/react";
import { LayoutDashboard, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardDisplaySettings } from "./dashboard-display-settings";
import {
  type DashboardDefinition,
  type DashboardWidget,
  initialWidgets,
  widgetKinds,
  widgetLabel,
} from "./dashboard-fixtures";
import { DashboardGrid } from "./dashboard-grid";
import { appendWidget, compactWidgets } from "./dashboard-layout";

export function DashboardPrototype() {
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const container = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState("desktop");
  const [saved, setSaved] = useState<DashboardDefinition>(() => ({
    widgets: compactWidgets(initialWidgets),
    mode: "vertical",
  }));
  const [draft, setDraft] = useState<DashboardDefinition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [announcement, setAnnouncement] = useState("");
  const definition = draft ?? saved;
  const { widgets, mode } = definition;
  const editing = draft !== null;
  const periods = [
    { id: "7", name: "Last 7 days" },
    { id: "3", name: "Last 3 days" },
  ];
  const widgetButton = (id: string) =>
    container.current?.querySelector<HTMLButtonElement>(`[data-configure-widget="${CSS.escape(id)}"]`);
  const finishEditing = (next: DashboardDefinition) => {
    setSaved(next);
    setDraft(null);
    setSelectedId(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const add = (kind: string) => {
    if (!draft) return;
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      title: `New ${widgetKinds.find(({ id }) => id === kind)?.name.toLowerCase()}`,
      kind: kind as DashboardWidget["kind"],
      source: "conversations",
      layout: { x: 0, y: 0, w: 6, h: kind === "metric" ? 3 : 8 },
    };
    setDraft({ ...definition, widgets: appendWidget(widgets, widget, mode) });
    setSelectedId(null);
    requestAnimationFrame(() => {
      widgetButton(widget.id)?.scrollIntoView({ block: "nearest" });
      setSelectedId(widget.id);
    });
    setAnnouncement(`${widget.title} added.`);
  };

  return (
    <Stack gap="md" p="md" minW="0">
      <HStack justify="space-between" flexWrap="wrap" gap="sm">
        <Text textStyle="label/S/medium">Preview size</Text>
        <SegmentedControl
          aria-label="Preview size"
          value={size}
          onValueChange={setSize}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "tablet", label: "Tablet" },
            { value: "phone", label: "Phone" },
          ]}
        />
      </HStack>
      <Box css={styles.preview} data-size={size} borderWidth="1px" borderColor="border.subtle">
        <Box ref={container} css={styles.root}>
          <Box css={styles.toolbar}>
            <HStack gap="sm" minW="0">
              <LayoutDashboard aria-hidden />
              <Text as="h1" textStyle="heading/S">
                Overview
              </Text>
              {editing && (
                <Text textStyle="label/XS/regular" color="fg.muted">
                  Editing
                </Text>
              )}
            </HStack>
            <Box css={styles.actions} role="group" aria-label="Dashboard controls">
              <SelectionMenu
                triggerAriaLabel="Date range"
                triggerLabel={periods.find(({ id }) => id === String(days))?.name}
                options={periods}
                selectedIds={[String(days)]}
                multiSelect={false}
                onToggle={(value) => setDays(Number(value))}
              />
              {editing ? (
                <>
                  <SelectionMenu
                    triggerAriaLabel="Add widget"
                    triggerLabel={
                      <>
                        <Plus />
                        Add widget
                      </>
                    }
                    options={widgetKinds}
                    selectedIds={[]}
                    multiSelect={false}
                    onToggle={add}
                  />
                  <Button onClick={() => finishEditing(saved)}>Cancel</Button>
                  <Button ref={applyButton} variant="primary" onClick={() => finishEditing(definition)}>
                    Apply
                  </Button>
                  <DashboardDisplaySettings
                    mode={mode}
                    onModeChange={(nextMode) => {
                      setSelectedId(null);
                      setDraft({ mode: nextMode, widgets: compactWidgets(widgets, nextMode) });
                    }}
                  />
                </>
              ) : (
                <Button ref={editButton} onClick={() => setDraft(saved)}>
                  <Pencil />
                  Edit dashboard
                </Button>
              )}
            </Box>
          </Box>
          <Box css={styles.body}>
            <ScrollArea flex="1" minH="0" minW="0">
              {widgets.length ? (
                <DashboardGrid
                  widgets={widgets}
                  editing={editing}
                  mode={mode}
                  selectedId={selectedId}
                  days={days}
                  onChange={(next) => {
                    setDraft({ ...definition, widgets: next });
                    setAnnouncement("Dashboard layout updated.");
                  }}
                  onConfigure={setSelectedId}
                  onWidgetChange={(updated) => {
                    setDraft({
                      ...definition,
                      widgets: widgets.map((widget) =>
                        widget.id === updated.id ? { ...updated, layout: widget.layout } : widget,
                      ),
                    });
                  }}
                  onRemove={(id) => {
                    const index = widgets.findIndex((widget) => widget.id === id);
                    const next = widgets[index + 1] ?? widgets[index - 1];
                    setDraft({
                      ...definition,
                      widgets: compactWidgets(
                        widgets.filter((widget) => widget.id !== id),
                        mode,
                      ),
                    });
                    setSelectedId(null);
                    setAnnouncement(`${widgetLabel(widgets[index])} removed.`);
                    requestAnimationFrame(() => (next ? widgetButton(next.id) : applyButton.current)?.focus());
                  }}
                  onGestureStart={() => setSelectedId(null)}
                />
              ) : (
                <Stack p="xl" align="center">
                  <Text textStyle="heading/S">No widgets</Text>
                  <Text textStyle="label/S/regular" color="fg.muted">
                    Add a widget to build your dashboard.
                  </Text>
                  {!editing && <Button onClick={() => setDraft(saved)}>Edit dashboard</Button>}
                </Stack>
              )}
            </ScrollArea>
          </Box>
          <VisuallyHidden role="status" aria-live="polite">
            {announcement}
          </VisuallyHidden>
        </Box>
      </Box>
    </Stack>
  );
}
