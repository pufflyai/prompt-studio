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
  sourcesForKind,
  widgetKinds,
  widgetLabel,
} from "./dashboard-types";

interface AppliedDashboard {
  definition: DashboardDefinition;
  previousValue: DashboardDefinition;
}

function sameDefinition(first: DashboardDefinition, second: DashboardDefinition) {
  if (first === second) return true;
  if (first.mode !== second.mode || first.widgets.length !== second.widgets.length) return false;
  return first.widgets.every((widget, index) => {
    const other = second.widgets[index];
    return (
      widget.id === other.id &&
      widget.kind === other.kind &&
      widget.source === other.source &&
      widget.title === other.title &&
      widget.layout.x === other.layout.x &&
      widget.layout.y === other.layout.y &&
      widget.layout.w === other.layout.w &&
      widget.layout.h === other.layout.h
    );
  });
}

function useAppliedDashboard(value: DashboardDefinition, editable: boolean) {
  const [applied, setApplied] = useState<AppliedDashboard | null>(null);
  // Saving can finish before the caller publishes the updated definition.
  const awaitingRefresh = applied && editable && sameDefinition(applied.previousValue, value);
  if (applied && !awaitingRefresh) setApplied(null);
  return {
    saved: awaitingRefresh ? applied.definition : value,
    markApplied: (definition: DashboardDefinition) => {
      if (!sameDefinition(definition, value)) setApplied({ definition, previousValue: value });
    },
  };
}

export function DashboardRenderer(props: DashboardRendererProps) {
  const { value, sources, onChange, title = "Overview", actions, renderToolbar } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const container = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const { saved, markApplied } = useAppliedDashboard(value, Boolean(onChange));
  const [draft, setDraft] = useState<DashboardDefinition | null>(null);
  const [originalCustomSources, setOriginalCustomSources] = useState<ReadonlyMap<string, string> | null>(null);
  const [removedCustomWidgets, setRemovedCustomWidgets] = useState<DashboardWidget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [saveError, setSaveError] = useState("");
  const [applying, setApplying] = useState(false);
  const editing = draft !== null && Boolean(onChange);
  const definition = editing && draft ? draft : saved;
  const { widgets, mode } = definition;
  const hiddenWidgets = editing ? removedCustomWidgets : [];
  const widgetButton = (id: string) =>
    container.current?.querySelector<HTMLButtonElement>(`[data-configure-widget="${CSS.escape(id)}"]`);
  const startEditing = () => {
    setOriginalCustomSources(
      new Map(saved.widgets.filter(({ kind }) => kind === "custom").map(({ id, source }) => [id, source])),
    );
    setDraft(saved);
  };
  const finishEditing = () => {
    setDraft(null);
    setOriginalCustomSources(null);
    setRemovedCustomWidgets([]);
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
      markApplied(definition);
      finishEditing();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not apply dashboard changes.");
    } finally {
      setApplying(false);
    }
  };
  const availableKinds = widgetKinds.filter(({ id }) => sourcesForKind(sources, id).length > 0);
  const add = (id: string) => {
    const kind = availableKinds.find((option) => option.id === id);
    if (!draft || !kind) return;
    const source = sourcesForKind(sources, kind.id)[0];
    if (!source) return;
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      title: kind.id === "custom" ? "" : `New ${kind.name.toLowerCase()}`,
      kind: kind.id,
      source: source.id,
      layout: { x: 0, y: 0, w: 6, h: kind.id === "metric" ? 3 : 8 },
    };
    setDraft({ ...definition, widgets: appendWidget(widgets, widget, mode) });
    setSelectedId(null);
    requestAnimationFrame(() => {
      widgetButton(widget.id)?.scrollIntoView({ block: "nearest" });
      setSelectedId(widget.id);
    });
    setAnnouncement(`${widgetLabel(widget, source.name)} added.`);
  };
  const remove = (id: string) => {
    const index = widgets.findIndex((widget) => widget.id === id);
    const removed = widgets[index];
    if (!removed) return;
    if (removed.kind === "custom" || originalCustomSources?.has(id)) {
      setRemovedCustomWidgets((previous) => [...previous, removed]);
    }
    const next = widgets[index + 1] ?? widgets[index - 1];
    setDraft({
      ...definition,
      widgets: compactWidgets(
        widgets.filter((widget) => widget.id !== id),
        mode,
      ),
    });
    setSelectedId(null);
    const source = sources.find(({ id }) => id === removed.source);
    setAnnouncement(`${widgetLabel(removed, source?.name)} removed.`);
    requestAnimationFrame(() => (next ? widgetButton(next.id) : applyButton.current)?.focus());
  };

  const controls = (
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
            options={availableKinds}
            selectedIds={[]}
            multiSelect={false}
            onToggle={add}
            disabled={!availableKinds.length || applying}
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
          <Button ref={editButton} onClick={startEditing}>
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
  );
  return (
    <Box ref={container} css={styles.root}>
      {renderToolbar ? (
        renderToolbar(controls)
      ) : (
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
          {controls}
        </Box>
      )}
      <Box css={styles.body}>
        <ScrollArea flex="1" minH="0" minW="0">
          {(widgets.length > 0 || hiddenWidgets.length > 0) && (
            <DashboardGrid
              widgets={widgets}
              hiddenWidgets={hiddenWidgets}
              originalCustomSources={editing ? originalCustomSources : null}
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
              onRemove={remove}
              onGestureStart={() => setSelectedId(null)}
            />
          )}
          {!widgets.length && (
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
