import { Box, Button, HStack, Stack, Text, useSlotRecipe, VisuallyHidden } from "@chakra-ui/react";
import { LayoutDashboard, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import {
  type DashboardDefinition,
  type DashboardLayoutMode,
  type DashboardWidget,
  initialWidgets,
  layoutModes,
  widgetKinds,
} from "./dashboard-fixtures";
import { DashboardGrid } from "./dashboard-grid";
import { WidgetInspector } from "./dashboard-inspector";
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
  const selected = widgets.find(({ id }) => id === selectedId);
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
    setSelectedId(widget.id);
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
            <Box css={styles.actions}>
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
                  <Box role="group" aria-label="Layout mode">
                    <SelectionMenu
                      triggerLabel={`Layout: ${layoutModes.find(({ id }) => id === mode)?.name}`}
                      options={layoutModes}
                      selectedIds={[mode]}
                      multiSelect={false}
                      onToggle={(value) => {
                        const nextMode = value as DashboardLayoutMode;
                        setDraft({ mode: nextMode, widgets: compactWidgets(widgets, nextMode) });
                      }}
                    />
                  </Box>
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
                  <Button
                    ref={applyButton}
                    variant="primary"
                    disabled={widgets.some(({ title }) => !title.trim())}
                    onClick={() => finishEditing(definition)}
                  >
                    Apply
                  </Button>
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
                  onConfigure={(id) => setSelectedId(selectedId === id ? null : id)}
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
            {editing && selected && (
              <Box as="aside" aria-label="Widget settings" css={styles.inspector}>
                <WidgetInspector
                  key={selected.id}
                  widget={selected}
                  onChange={(updated) => {
                    setDraft({
                      ...definition,
                      widgets: widgets.map((widget) => (widget.id === updated.id ? updated : widget)),
                    });
                  }}
                  onRemove={() => {
                    const index = widgets.findIndex(({ id }) => id === selected.id);
                    const next = widgets[index + 1] ?? widgets[index - 1];
                    setDraft({
                      ...definition,
                      widgets: compactWidgets(
                        widgets.filter(({ id }) => id !== selected.id),
                        mode,
                      ),
                    });
                    setSelectedId(null);
                    setAnnouncement(`${selected.title} removed.`);
                    requestAnimationFrame(() => (next ? widgetButton(next.id) : applyButton.current)?.focus());
                  }}
                  onClose={() => {
                    setSelectedId(null);
                    widgetButton(selected.id)?.focus();
                  }}
                />
              </Box>
            )}
          </Box>
          <VisuallyHidden role="status" aria-live="polite">
            {announcement}
          </VisuallyHidden>
        </Box>
      </Box>
    </Stack>
  );
}
