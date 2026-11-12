import { Box, Button, HStack, Stack, Text, useSlotRecipe, VisuallyHidden } from "@chakra-ui/react";
import { LayoutDashboard, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { type DashboardWidget, initialWidgets, widgetKinds } from "./dashboard-fixtures";
import { WidgetInspector } from "./dashboard-inspector";
import { WidgetCard } from "./dashboard-widget";

export function DashboardPrototype() {
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const container = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState("desktop");
  const [saved, setSaved] = useState(initialWidgets);
  const [draft, setDraft] = useState<DashboardWidget[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [announcement, setAnnouncement] = useState("");
  const widgets = draft ?? saved;
  const selected = widgets.find(({ id }) => id === selectedId);
  const editing = draft !== null;
  const periods = [
    { id: "7", name: "Last 7 days" },
    { id: "3", name: "Last 3 days" },
  ];
  const widgetButton = (id: string) =>
    container.current?.querySelector<HTMLButtonElement>(`[data-configure-widget="${CSS.escape(id)}"]`);
  const finishEditing = (next: DashboardWidget[]) => {
    setSaved(next);
    setDraft(null);
    setSelectedId(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const move = (fromId: string, toId: string) => {
    if (!draft || fromId === toId) return;
    const from = draft.findIndex(({ id }) => id === fromId);
    const to = draft.findIndex(({ id }) => id === toId);
    if (from < 0 || to < 0) return;
    const next = [...draft];
    const [widget] = next.splice(from, 1);
    next.splice(to, 0, widget);
    setDraft(next);
    setAnnouncement(`${widget.title} moved to position ${to + 1} of ${next.length}.`);
  };
  const add = (kind: string) => {
    if (!draft) return;
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      title: `New ${widgetKinds.find(({ id }) => id === kind)?.name.toLowerCase()}`,
      kind: kind as DashboardWidget["kind"],
      source: "conversations",
      width: "half",
      height: "standard",
    };
    setDraft([...draft, widget]);
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
                    onClick={() => finishEditing(widgets)}
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
                <Box css={styles.grid}>
                  {widgets.map((widget, index) => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      editing={editing}
                      selected={widget.id === selectedId}
                      first={index === 0}
                      last={index === widgets.length - 1}
                      days={days}
                      onConfigure={() => setSelectedId(selectedId === widget.id ? null : widget.id)}
                      onMove={(offset) => {
                        const target = widgets[index + offset];
                        if (target) move(widget.id, target.id);
                      }}
                      onDrop={(id) => move(id, widget.id)}
                    />
                  ))}
                </Box>
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
                  onChange={(updated) =>
                    setDraft(widgets.map((widget) => (widget.id === updated.id ? updated : widget)))
                  }
                  onRemove={() => {
                    const index = widgets.findIndex(({ id }) => id === selected.id);
                    const next = widgets[index + 1] ?? widgets[index - 1];
                    setDraft(widgets.filter(({ id }) => id !== selected.id));
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
