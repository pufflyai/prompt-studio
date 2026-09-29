import { Box, Button, chakra, Dialog, HStack, Icon, IconButton, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import { Copy, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import type { FilterCategoryView } from "./kanban-renderer-helpers";
import { isKanbanRendererViewDirty } from "./kanban-renderer-views";
import type { KanbanRendererFilterState, KanbanRendererSavedView, KanbanRendererViewsSource } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

interface KanbanRendererViewBarProps {
  storageKey: string;
  views: (KanbanRendererSavedView & { builtIn: boolean })[];
  defaultViewId?: string;
  viewsSource?: KanbanRendererViewsSource;
  categories: FilterCategoryView[];
  filters: KanbanRendererFilterState;
  leading?: ReactNode;
  filterControl: ReactNode;
  displayControl: ReactNode;
  align?: "split" | "end";
}

const nextViewTitle = (views: KanbanRendererSavedView[]) => {
  let index = views.length + 1;
  while (views.some((view) => view.title === `View ${index}`)) index += 1;
  return `View ${index}`;
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
  const {
    storageKey,
    views,
    viewsSource,
    defaultViewId,
    categories,
    filters,
    leading,
    filterControl,
    displayControl,
    align = "split",
  } = props;
  const activeViewId = useKanbanRendererStore(storageKey, (state) => state.activeViewId);
  const settings = useKanbanRendererStore(storageKey, (state) => state.settings);
  const activeView = views.find((view) => view.id === activeViewId);
  const dirty = isKanbanRendererViewDirty(activeView, { settings, filters });
  const activateView = useKanbanRendererStore(storageKey, (state) => state.activateView);
  const clearFilter = useKanbanRendererStore(storageKey, (state) => state.clearFilter);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const createView = async (input: Parameters<KanbanRendererViewsSource["onCreateView"]>[0]) => {
    if (viewsSource) activateView(await viewsSource.onCreateView(input));
  };
  const [renameTarget, setRenameTarget] = useState<KanbanRendererSavedView>();
  const activeFilters = Object.entries(filters).filter(([, values]) => values.length > 0);
  const showFilterRow = dirty || activeFilters.length > 0;

  const actionsFor = (view: KanbanRendererSavedView & { builtIn: boolean }): ResourceContextAction[] =>
    viewsSource
      ? [
          {
            key: "rename",
            label: "Rename",
            isDisabled: view.builtIn || busy,
            icon: <Icon as={Pencil} boxSize="0.875rem" />,
            onClick: () => setRenameTarget(view),
          },
          {
            key: "duplicate",
            label: "Duplicate",
            icon: <Icon as={Copy} boxSize="0.875rem" />,
            onClick: () =>
              run(() =>
                createView({
                  settings: view.settings,
                  filters: view.filters,
                  title: `${view.title} copy`,
                  copyFrom: view.id,
                }),
              ),
            isDisabled: busy,
          },
          {
            key: "delete",
            label: "Delete view",
            icon: <Icon as={Trash2} boxSize="0.875rem" />,
            isDisabled: view.builtIn || busy,
            separatorBefore: true,
            onClick: () => run(() => viewsSource.onDeleteView(view.id)),
          },
          {
            key: "default",
            label: view.id === defaultViewId ? "Clear default" : "Set as default",
            isDisabled: busy,
            onClick: () => run(() => viewsSource.onSetDefaultView(view.id === defaultViewId ? null : view.id)),
          },
        ]
      : [];

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
          onValueChange={(details) => {
            const view = views.find((view) => view.id === details.value);
            if (view) activateView(view);
          }}
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
            disabled={!viewsSource || busy}
            onClick={() => viewsSource && run(() => createView({ title: nextViewTitle(views), settings, filters }))}
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
              <Button size="2xs" variant="outline" onClick={() => activeView && activateView(activeView)}>
                <RotateCcw />
                Reset
              </Button>
              <Button
                size="2xs"
                variant="primary"
                disabled={!viewsSource || busy}
                onClick={() =>
                  viewsSource &&
                  activeView &&
                  run(() =>
                    activeView.builtIn
                      ? createView({
                          title: `${activeView.title} copy`,
                          settings,
                          filters,
                        })
                      : viewsSource.onUpdateView(activeView.id, { settings, filters }),
                  )
                }
              >
                {activeView?.builtIn ? "Save as new view" : "Save view"}
              </Button>
            </>
          ) : null}
        </HStack>
      ) : null}

      {error ? (
        <Text role="alert" color="fg.error" textStyle="label/S" padding="xs">
          {error}
        </Text>
      ) : null}
      {renameTarget ? (
        <RenameViewDialog
          key={renameTarget.id}
          open
          title={renameTarget.title}
          onOpenChange={(open) => !open && setRenameTarget(undefined)}
          onRename={(title) => viewsSource && run(() => viewsSource.onUpdateView(renameTarget.id, { title }))}
        />
      ) : null}
    </Stack>
  );
};
