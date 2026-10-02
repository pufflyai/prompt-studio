import { Box, Button, Dialog, Icon, IconButton, Input, Tabs, Text } from "@chakra-ui/react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
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
  defaultViewId?: string;
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
  const { views, activeViewId, defaultViewId, viewsSource, dirty, busy, state, onActivate, run, createView } = props;
  const [renameTarget, setRenameTarget] = useState<CollectionSavedView<TSettings>>();

  const actionsFor = (view: CollectionSavedView<TSettings> & { builtIn: boolean }): ResourceContextAction[] =>
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
        <Tabs.List overflowX="auto" overflowY="hidden">
          {views.map((view) => (
            <ResourceContextMenu key={view.id} actions={actionsFor(view)} positioning={{ placement: "bottom-start" }}>
              <Tabs.Trigger value={view.id} title={view.title}>
                <Text as="span" data-tab-label>
                  {view.title}
                </Text>
                {dirty && view.id === activeViewId ? (
                  <Box
                    aria-label="Unsaved view changes"
                    width="0.375rem"
                    height="0.375rem"
                    flexShrink={0}
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
          onClick={() => viewsSource && run(() => createView({ title: nextViewTitle(views), ...state }))}
        >
          <Icon as={Plus} />
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
