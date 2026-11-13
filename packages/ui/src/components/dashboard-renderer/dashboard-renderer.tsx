import { Box, Button, HStack, Text, useSlotRecipe, VisuallyHidden } from "@chakra-ui/react";
import { LayoutDashboard, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardDisplaySettings } from "./dashboard-display-settings";
import { DashboardGrid } from "./dashboard-grid";
import { appendWidget, compactWidgets } from "./dashboard-layout";
import {
  type DashboardDefinition,
  type DashboardRendererProps,
  type DashboardWidget,
  widgetKinds,
  widgetLabel,
} from "./dashboard-types";

export function DashboardRenderer(props: DashboardRendererProps) {
  const { value, sources, onChange, title = "Overview", actions } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const container = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<DashboardDefinition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [saveError, setSaveError] = useState("");
  const [applying, setApplying] = useState(false);
  const editing = draft !== null && Boolean(onChange);
  const definition = editing && draft ? draft : value;
  const { widgets, mode } = definition;
  const widgetButton = (id: string) =>
    container.current?.querySelector<HTMLButtonElement>(`[data-configure-widget="${CSS.escape(id)}"]`);
  const finishEditing = () => {
    setDraft(null);
    setSelectedId(null);
    setSaveError("");
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const apply = async () => {
    if (!onChange || applying) return;
    setApplying(true);
    setSaveError("");
    try {
      await onChange(definition);
      finishEditing();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not apply dashboard changes.");
    } finally {
      setApplying(false);
    }
  };
  const add = (kind: string) => {
    if (!draft || !sources.length) return;
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      title: `New ${widgetKinds.find(({ id }) => id === kind)?.name.toLowerCase()}`,
      kind: kind as DashboardWidget["kind"],
      source: sources[0].id,
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
    <Box ref={container} css={styles.root}>
      <Box css={styles.toolbar}>
        <HStack gap="sm" minW="0">
          <LayoutDashboard aria-hidden />
          <Text as="h1" textStyle="heading/S">
            {title}
          </Text>
          {editing && (
            <Text textStyle="label/XS/regular" color="fg.muted">
              Editing
            </Text>
          )}
        </HStack>
        <Box css={styles.actions} role="group" aria-label="Dashboard controls">
          {actions}
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
                disabled={!sources.length || applying}
              />
              <Button onClick={finishEditing} disabled={applying}>
                Cancel
              </Button>
              <Button ref={applyButton} variant="primary" onClick={apply} disabled={applying}>
                {saveError ? "Retry" : "Apply"}
              </Button>
              <DashboardDisplaySettings
                mode={mode}
                disabled={applying}
                onModeChange={(nextMode) => {
                  setSelectedId(null);
                  setDraft({ mode: nextMode, widgets: compactWidgets(widgets, nextMode) });
                }}
              />
            </>
          ) : (
            onChange && (
              <Button ref={editButton} onClick={() => setDraft(value)}>
                <Pencil />
                Edit dashboard
              </Button>
            )
          )}
          {saveError && editing && (
            <Text role="alert" color="fg.error" textStyle="label/S/regular">
              {saveError}
            </Text>
          )}
        </Box>
      </Box>
      <Box css={styles.body}>
        <ScrollArea flex="1" minH="0" minW="0">
          {widgets.length ? (
            <DashboardGrid
              widgets={widgets}
              sources={sources}
              editing={editing && !applying}
              mode={mode}
              selectedId={selectedId}
              onChange={(next) => {
                setDraft({ ...definition, widgets: next });
                setAnnouncement("Dashboard layout updated.");
              }}
              onConfigure={setSelectedId}
              onWidgetChange={(updated) =>
                setDraft({
                  ...definition,
                  widgets: widgets.map((widget) =>
                    widget.id === updated.id ? { ...updated, layout: widget.layout } : widget,
                  ),
                })
              }
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
            <Text p="xl" textStyle="label/S/regular" color="fg.muted">
              No widgets
            </Text>
          )}
        </ScrollArea>
      </Box>
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
    </Box>
  );
}
