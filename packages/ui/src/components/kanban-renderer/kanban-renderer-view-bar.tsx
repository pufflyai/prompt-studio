import { Box, Button, chakra, Dialog, HStack, Icon, IconButton, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import { Copy, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import type { FilterCategoryView } from "./kanban-renderer-helpers";
import type { KanbanRendererFilterState, KanbanRendererSavedView } from "./types";
import { isActiveKanbanRendererViewDirty, useKanbanRendererStore } from "./use-kanban-renderer-store";

interface KanbanRendererViewBarProps {
  storageKey: string;
  categories: FilterCategoryView[];
  filters: KanbanRendererFilterState;
  leading?: ReactNode;
  filterControl: ReactNode;
  displayControl: ReactNode;
  align?: "split" | "end";
}

const nextViewIdentity = (views: KanbanRendererSavedView[]) => {
  let index = views.length + 1;
  while (views.some((view) => view.id === `view-${index.toString()}`)) index += 1;
  return { id: `view-${index.toString()}`, title: `View ${index.toString()}` };
};

const duplicateIdentity = (view: KanbanRendererSavedView, views: KanbanRendererSavedView[]) => {
  const baseId = `${view.id}-copy`;
  let index = 1;
  let id = baseId;
  while (views.some((entry) => entry.id === id)) {
    index += 1;
    id = `${baseId}-${index.toString()}`;
  }
  return { id, title: `${view.title} copy` };
};

const filterValueLabel = (category: FilterCategoryView | undefined, values: string[]) =>
  values.map((value) => category?.options.find((option) => option.value === value)?.label ?? value).join(", ");

const FilterPill = (props: { category: FilterCategoryView | undefined; values: string[]; onRemove: () => void }) => {
  const { category, values, onRemove } = props;
  const label = category?.label ?? "Filter";

  return (
    <HStack
      height="filter-pill"
      gap="2xs"
      paddingLeft="xs"
      paddingRight="2xs"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="xs"
      bg="bg.muted"
      flexShrink={0}
    >
      <Text textStyle="label/XS" color="fg.muted">
        {label} {values.length > 1 ? "is any of" : "is"}
      </Text>
      <Text textStyle="label/XS/medium" maxW="12rem" truncate>
        {filterValueLabel(category, values)}
      </Text>
      <chakra.button
        type="button"
        aria-label={`Remove ${label} filter`}
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="1rem"
        height="1rem"
        color="fg.muted"
        borderRadius="xs"
        _hover={{ color: "fg", bg: "bg.hover" }}
        onClick={onRemove}
      >
        <Icon as={X} boxSize="0.75rem" />
      </chakra.button>
    </HStack>
  );
};

const RenameViewDialog = (props: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => void;
}) => {
  const { open, title, onOpenChange, onRename } = props;
  const [value, setValue] = useState(title);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = value.trim();
    if (!nextTitle) return;
    onRename(nextTitle);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
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
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
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

export const KanbanRendererViewBar = (props: KanbanRendererViewBarProps) => {
  const { storageKey, categories, filters, leading, filterControl, displayControl, align = "split" } = props;
  const views = useKanbanRendererStore(storageKey, (state) => state.views);
  const activeViewId = useKanbanRendererStore(storageKey, (state) => state.activeViewId);
  const dirty = useKanbanRendererStore(storageKey, isActiveKanbanRendererViewDirty);
  const activateView = useKanbanRendererStore(storageKey, (state) => state.activateView);
  const createView = useKanbanRendererStore(storageKey, (state) => state.createView);
  const saveActiveView = useKanbanRendererStore(storageKey, (state) => state.saveActiveView);
  const resetActiveView = useKanbanRendererStore(storageKey, (state) => state.resetActiveView);
  const clearFilter = useKanbanRendererStore(storageKey, (state) => state.clearFilter);
  const renameView = useKanbanRendererStore(storageKey, (state) => state.renameView);
  const duplicateView = useKanbanRendererStore(storageKey, (state) => state.duplicateView);
  const deleteView = useKanbanRendererStore(storageKey, (state) => state.deleteView);
  const [renameTarget, setRenameTarget] = useState<KanbanRendererSavedView>();
  const activeFilters = Object.entries(filters).filter(([, values]) => values.length > 0);
  const showFilterRow = dirty || activeFilters.length > 0;

  const actionsFor = (view: KanbanRendererSavedView): ResourceContextAction[] => [
    {
      key: "rename",
      label: "Rename",
      icon: <Icon as={Pencil} boxSize="0.875rem" />,
      onClick: () => setRenameTarget(view),
    },
    {
      key: "duplicate",
      label: "Duplicate",
      icon: <Icon as={Copy} boxSize="0.875rem" />,
      onClick: () => duplicateView(view.id, duplicateIdentity(view, views)),
    },
    {
      key: "delete",
      label: "Delete view",
      icon: <Icon as={Trash2} boxSize="0.875rem" />,
      isDisabled: views.length === 1,
      separatorBefore: true,
      onClick: () => deleteView(view.id),
    },
  ];

  return (
    <Stack
      data-testid="kanban-renderer-header"
      gap="0"
      flexShrink={0}
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <HStack height="view-bar" minW="0" gap="2xs" paddingX="xs">
        {leading}
        <Tabs.Root
          value={activeViewId}
          size="sm"
          variant="subtle"
          minW="0"
          overflow="hidden"
          onValueChange={(details) => activateView(details.value)}
        >
          <Tabs.List overflowX="auto" overflowY="hidden">
            {views.map((view) => (
              <ResourceContextMenu key={view.id} actions={actionsFor(view)} positioning={{ placement: "bottom-start" }}>
                <Tabs.Trigger value={view.id}>
                  {view.title}
                  {dirty && view.id === activeViewId ? (
                    <Box
                      aria-label="Unsaved view changes"
                      width="0.375rem"
                      height="0.375rem"
                      borderRadius="full"
                      bg="fg.warning"
                    />
                  ) : null}
                </Tabs.Trigger>
              </ResourceContextMenu>
            ))}
          </Tabs.List>
        </Tabs.Root>
        <Tooltip content="Add view">
          <IconButton
            aria-label="Add view"
            size="2xs"
            variant="ghost"
            onClick={() => createView(nextViewIdentity(views))}
          >
            <Icon as={Plus} />
          </IconButton>
        </Tooltip>
        {align === "split" ? <Box flex="1" /> : null}
        {filterControl}
        {displayControl}
      </HStack>

      {showFilterRow ? (
        <HStack
          height="view-subheader"
          minW="0"
          gap="2xs"
          paddingX="xs"
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <HStack minW="0" gap="2xs" overflowX="auto">
            {activeFilters.map(([categoryId, values]) => (
              <FilterPill
                key={categoryId}
                category={categories.find((category) => category.id === categoryId)}
                values={values}
                onRemove={() => clearFilter(categoryId)}
              />
            ))}
          </HStack>
          <Box flex="1" />
          {dirty ? (
            <>
              <Button size="2xs" variant="outline" onClick={resetActiveView}>
                <RotateCcw />
                Reset
              </Button>
              <Button size="2xs" variant="primary" onClick={saveActiveView}>
                Save view
              </Button>
            </>
          ) : null}
        </HStack>
      ) : null}

      {renameTarget ? (
        <RenameViewDialog
          key={renameTarget.id}
          open
          title={renameTarget.title}
          onOpenChange={(open) => !open && setRenameTarget(undefined)}
          onRename={(title) => renameView(renameTarget.id, title)}
        />
      ) : null}
    </Stack>
  );
};
