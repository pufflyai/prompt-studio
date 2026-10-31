import { Box, Button, Icon, IconButton, Input, Tabs } from "@chakra-ui/react";
import {
  DndContext,
  type DragOverEvent,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Copy, LayersPlus, Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { CollectionViewTab } from "./collection-view-tab";
import type { CollectionSavedView, CollectionViewState, CollectionViewsSource } from "./collection-view-types";

interface RenameViewDialogProps {
  title: string;
  onClose: () => void;
  onRename: (title: string) => void;
}

const RenameViewDialog = (props: RenameViewDialogProps) => {
  const { title, onClose, onRename } = props;
  const [value, setValue] = useState(title);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = value.trim();
    if (!nextTitle) return;
    onRename(nextTitle);
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content asChild>
          <form onSubmit={submit}>
            <Dialog.Header>
              <Dialog.Title>Rename view</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Input
                autoFocus
                aria-label="View name"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!value.trim()}>
                Rename
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

const nextViewTitle = (views: { title: string }[]) => {
  let index = views.length + 1;
  while (views.some((view) => view.title === `View ${index}`)) index += 1;
  return `View ${index}`;
};

export interface CollectionViewTabsProps<TSettings> {
  views: (CollectionSavedView<TSettings> & { builtIn: boolean })[];
  activeViewId: string;
  viewsSource?: CollectionViewsSource<TSettings>;
  dirty: boolean;
  busy: boolean;
  state: CollectionViewState<TSettings>;
  onActivate: (view: CollectionSavedView<TSettings>) => void;
  /** Runs a views-source call and reports its error in the bar. */
  run: (action: () => Promise<void>) => void;
  createView: (input: Parameters<CollectionViewsSource<TSettings>["onCreateView"]>[0]) => Promise<void>;
}

export const CollectionViewTabs = <TSettings,>(props: CollectionViewTabsProps<TSettings>) => {
  const { views, activeViewId, viewsSource, dirty, busy, state, onActivate, run, createView } = props;
  const [renameTarget, setRenameTarget] = useState<CollectionSavedView<TSettings>>();
  const [draggedId, setDraggedId] = useState<string>();
  const [drop, setDrop] = useState<{ id: string; edge: "before" | "after" }>();
  const reorderable = Boolean(viewsSource?.onReorderViews && !busy && views.length > 1);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const resolveDrop = (event: DragOverEvent) => {
    if (!event.over || event.active.id === event.over.id) return undefined;
    const rect = event.active.rect.current.translated;
    const before = rect && rect.left + rect.width / 2 < event.over.rect.left + event.over.rect.width / 2;
    return { id: String(event.over.id), edge: before ? ("before" as const) : ("after" as const) };
  };
  const reorder = (id: string, targetId: string, edge: "before" | "after") => {
    if (!reorderable || id === targetId) return;
    const order = views.map((view) => view.id);
    const remaining = order.filter((viewId) => viewId !== id);
    const index = remaining.indexOf(targetId);
    if (index === -1 || !order.includes(id)) return;
    remaining.splice(index + (edge === "after" ? 1 : 0), 0, id);
    if (remaining.every((viewId, position) => viewId === order[position])) return;
    run(() => viewsSource!.onReorderViews!(remaining));
  };
  const finishDrag = () => {
    setDraggedId(undefined);
    setDrop(undefined);
  };

  const actionsFor = (view: CollectionSavedView<TSettings> & { builtIn: boolean }): ResourceContextAction[] =>
    viewsSource
      ? [
          {
            key: "rename",
            label: "Rename",
            isDisabled: busy,
            icon: <Icon as={Pencil} boxSize="0.875rem" />,
            onClick: () => setRenameTarget(view),
          },
          {
            key: "duplicate",
            label: "Duplicate",
            icon: <Icon as={Copy} boxSize="0.875rem" />,
            isDisabled: busy,
            onClick: () =>
              run(() =>
                createView({
                  settings: view.settings,
                  filter: view.filter,
                  sorts: view.sorts,
                  title: `${view.title} copy`,
                  copyFrom: view.id,
                }),
              ),
          },
          {
            key: "delete",
            label: "Delete view",
            icon: <Icon as={Trash2} boxSize="0.875rem" />,
            isDisabled: views.length === 1 || busy,
            separatorBefore: true,
            onClick: () => run(() => viewsSource.onDeleteView(view.id)),
          },
        ]
      : [];

  return (
    <>
      <Tabs.Root
        value={activeViewId}
        size="sm"
        variant="subtle"
        minW="0"
        overflow="hidden"
        onValueChange={(details) => {
          const view = views.find((entry) => entry.id === details.value);
          if (view) onActivate(view);
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={({ active }) => setDraggedId(String(active.id))}
          onDragOver={(event) => setDrop(resolveDrop(event))}
          onDragMove={(event) => setDrop(resolveDrop(event))}
          onDragCancel={finishDrag}
          onDragEnd={(event) => {
            const target = resolveDrop(event);
            finishDrag();
            if (target) reorder(String(event.active.id), target.id, target.edge);
          }}
        >
          <ScrollArea height="auto" showHorizontalScrollbar showVerticalScrollbar={false}>
            <Tabs.List width="max-content">
              {views.map((view, index) => (
                <CollectionViewTab
                  key={view.id}
                  id={view.id}
                  title={view.title}
                  actions={actionsFor(view)}
                  dirty={dirty && view.id === activeViewId}
                  reorderable={reorderable}
                  dropEdge={drop?.id === view.id ? drop.edge : undefined}
                  onMove={(direction) => {
                    const neighbor = views[index + (direction === "left" ? -1 : 1)];
                    if (neighbor) reorder(view.id, neighbor.id, direction === "left" ? "before" : "after");
                  }}
                />
              ))}
            </Tabs.List>
          </ScrollArea>
          <Box asChild pointerEvents="none">
            <DragOverlay dropAnimation={null}>
              {draggedId ? (
                <Box layerStyle="floatingBar" textStyle="label/XS/medium">
                  {views.find((view) => view.id === draggedId)?.title}
                </Box>
              ) : null}
            </DragOverlay>
          </Box>
        </DndContext>
      </Tabs.Root>
      <Tooltip content="Add view">
        <IconButton
          aria-label="Add view"
          size="2xs"
          variant="ghost"
          disabled={!viewsSource || busy}
          onClick={() => viewsSource && run(() => createView({ title: nextViewTitle(views), ...state }))}
        >
          <Icon as={LayersPlus} />
        </IconButton>
      </Tooltip>
      {renameTarget && viewsSource ? (
        <RenameViewDialog
          key={renameTarget.id}
          title={renameTarget.title}
          onClose={() => setRenameTarget(undefined)}
          onRename={(title) => run(() => viewsSource.onUpdateView(renameTarget.id, { title }))}
        />
      ) : null}
    </>
  );
};
