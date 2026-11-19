import { IconButton, Stack } from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { type RendererContext, resourceKey } from "@pstdio/sdk/extensions";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { type KeyboardEvent, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ResourceRef, WorkbenchPanelRenderInput } from "../../core";
import { rendererReadKey } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import type { NativeActionBarSnapshot } from "../../extensions/contributions/action-bar-snapshot";
import { WorkbenchShortcutHint } from "../keybindings/shortcut-hint";
import { RendererReadNotice } from "../renderers/renderer-read-notice";
import { usePageParams } from "../renderers/use-page-params";
import { useRendererRead } from "../renderers/use-renderer-read";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { executeActionBarTarget } from "./action-bar-action";
import { ActionBarDragPreview, SortableActionBarItem, useActionBarDrag } from "./action-bar-drag";
import { ActionBarMenuButton } from "./action-bar-menu";
import { type ActionBarDropEdge, applyActionBarOrder, createActionBarOrder } from "./action-bar-order";

interface WorkbenchActionBarProps {
  ownerId: string;
  lifetime: AbortSignal;
  render: WorkbenchPanelRenderInput;
  viewId: string;
  title: string;
  projectId: string;
  extensionId: string;
  orientation?: "vertical" | "horizontal";
  refreshEvents?: string[];
  load(renderer: RendererContext, signal: AbortSignal): Promise<NativeActionBarSnapshot>;
}

export const WorkbenchActionBar = (props: WorkbenchActionBarProps) => {
  const { render, projectId } = props;
  const { workbench, instance } = render;
  // Chrome has no resource binding of its own. It follows the page's primary resource.
  const primary = useWorkbenchStore(workbench.pages.store, (state) => state.location?.resource);
  const pageId = useWorkbenchStore(workbench.pages.store, (state) => state.activePageId);
  const modeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const edge = useWorkbenchStore(workbench.layout.store, () => workbench.shell.getArrangement().activity);
  let orientation = props.orientation ?? "vertical";
  if (render.panel.region === "activity") orientation = edge === "top" || edge === "bottom" ? "horizontal" : "vertical";
  const resource = instance.resource ?? primary;
  return (
    <ActionBarContents
      key={JSON.stringify([projectId, modeId, pageId, resourceKey(resource)])}
      {...props}
      orientation={orientation}
      resource={resource}
      modeId={modeId}
    />
  );
};

const ActionBarContents = (props: WorkbenchActionBarProps & { resource?: ResourceRef; modeId?: string }) => {
  const {
    render,
    viewId,
    title,
    projectId,
    extensionId,
    orientation = "vertical",
    refreshEvents,
    load,
    resource,
    modeId,
    lifetime,
    ownerId,
  } = props;
  const { workbench, instance } = render;
  const pageParams = usePageParams(workbench, instance);
  const horizontal = orientation === "horizontal";
  const [focused, setFocused] = useState<string>();
  useWorkbenchStore(workbench.commands.store, (state) => state);
  useWorkbenchStore(workbench.context.store, (state) => state);
  const read = useRendererRead({
    enabled: render.visible !== false,
    workbench,
    ownerKey: rendererReadKey(instance),
    sourceId: viewId,
    queryScope: { projectId, extensionId },
    queryEvents: refreshEvents,
    queryKey: JSON.stringify([ownerId, viewId, modeId, resourceKey(resource), pageParams]),
    dependency: { resourceKey: resourceKey(resource), resourceId: resource?.id },
    load: (signal) =>
      load(
        { rendererId: viewId, projectId, modeId, resource, pageParams, invocation: { placement: "visible" } },
        signal,
      ),
  });
  const order = createActionBarOrder(workbench.preferences, projectId, viewId);
  const savedOrder = useWorkbenchStore(workbench.preferences.store, useShallow(order.read));
  const items = applyActionBarOrder(read.value?.items ?? [], savedOrder);
  const move = (id: string, targetId: string, edge: ActionBarDropEdge, onSuccess?: () => void) => {
    if (lifetime.aborted || render.visible === false) return;
    void runUserAction(workbench, "Reorder toolbar", () => order.move(items, id, targetId, edge), { onSuccess });
  };
  const drag = useActionBarDrag(horizontal, move);
  const reorderable = items.length > 1;
  const backwards = horizontal ? "ArrowLeft" : "ArrowUp";
  const forwards = horizontal ? "ArrowRight" : "ArrowDown";
  const reorderShortcuts = reorderable ? `Alt+${backwards} Alt+${forwards}` : undefined;
  const reorderWithKeys = (event: KeyboardEvent<HTMLElement>, button: HTMLElement) => {
    if (!reorderable || ![backwards, forwards].includes(event.key)) return;
    const id = button.closest<HTMLElement>("[data-action-bar-item]")?.dataset.actionBarItem;
    if (id === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const before = event.key === backwards;
    const neighbor = items[items.findIndex((item) => item.id === id) + (before ? -1 : 1)];
    if (neighbor)
      move(id, neighbor.id, before ? "before" : "after", () => {
        requestAnimationFrame(() => {
          // Moving an existing DOM node can blur it. Keep keyboard navigation on that tool.
          if (button.isConnected && button.ownerDocument.activeElement === button.ownerDocument.body) button.focus();
        });
      });
  };
  type Action = Exclude<NativeActionBarSnapshot["items"][number], { items: unknown }>;
  const context = { projectId, resource, placement: instance.placementIdentity };
  const available = (item: Action) => {
    if (item.disabled) return false;
    const action = item.action;
    return (
      action.kind !== "command" ||
      Boolean(
        workbench.commands.getCommand(action.commandId) &&
          workbench.commands.isCommandEnabled(action.commandId, action.args, context),
      )
    );
  };
  const enabled = (item: NativeActionBarSnapshot["items"][number]) =>
    "items" in item ? !item.disabled : available(item);
  const tabStop = items.find((item) => item.id === focused && enabled(item))?.id ?? items.find(enabled)?.id;
  const run = (item: Action) => {
    if (!available(item)) return;
    if (lifetime.aborted) return;
    if (workbench.pages.store.getState().projectId !== projectId) return;
    if (workbench.modes.getActiveModeId() !== modeId) return;
    if (resourceKey(instance.resource ?? workbench.getPrimaryResource()) !== resourceKey(resource)) return;
    const action = item.action;
    void runUserAction(workbench, item.label, () => executeActionBarTarget(workbench, action, context));
  };
  return (
    <DndContext {...drag.context}>
      <ScrollArea
        viewportRef={drag.viewport}
        h="full"
        w="full"
        showHorizontalScrollbar={horizontal}
        showVerticalScrollbar={!horizontal}
        contentProps={horizontal ? { h: "full" } : undefined}
      >
        <Stack
          role="toolbar"
          aria-label={title}
          aria-orientation={horizontal ? "horizontal" : "vertical"}
          direction={horizontal ? "row" : "column"}
          align="center"
          gap="xs"
          h={horizontal ? "full" : undefined}
          px={horizontal ? "sm" : "0"}
          py={horizontal ? "0" : "sm"}
          onKeyDownCapture={(event) => {
            const { currentTarget, target } = event;
            if (
              event.altKey &&
              !event.shiftKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              target instanceof HTMLButtonElement &&
              currentTarget.contains(target)
            )
              reorderWithKeys(event, target);
          }}
          onKeyDown={(event) => {
            if (event.altKey || ![backwards, forwards, "Home", "End"].includes(event.key)) return;
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            if (index < 0) return;
            event.preventDefault();
            let next = (index + (event.key === backwards ? -1 : 1) + buttons.length) % buttons.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = buttons.length - 1;
            buttons[next]?.focus();
          }}
        >
          {items.map((item) => (
            <SortableActionBarItem
              key={item.id}
              id={item.id}
              reorderable={reorderable}
              horizontal={horizontal}
              dropEdge={drag.drop?.id === item.id ? drag.drop.edge : undefined}
            >
              {"items" in item ? (
                <ActionBarMenuButton
                  item={item}
                  workbench={workbench}
                  horizontal={horizontal}
                  tabIndex={item.id === tabStop ? 0 : -1}
                  reorderShortcuts={reorderShortcuts}
                  onFocus={() => setFocused(item.id)}
                  available={available}
                  run={run}
                />
              ) : (
                <Tooltip
                  positioning={{ placement: horizontal ? "bottom" : "right" }}
                  content={
                    <WorkbenchShortcutHint workbench={workbench} action={item.action} includeLayers>
                      {item.label}
                    </WorkbenchShortcutHint>
                  }
                >
                  <IconButton
                    aria-label={item.label}
                    aria-keyshortcuts={reorderShortcuts}
                    aria-pressed={item.selected}
                    variant={item.selected ? "subtle" : "ghost"}
                    size="xs"
                    disabled={!available(item)}
                    tabIndex={item.id === tabStop ? 0 : -1}
                    onFocus={() => setFocused(item.id)}
                    onClick={() => run(item)}
                  >
                    <WorkbenchIcon name={item.icon ?? "Circle"} />
                  </IconButton>
                </Tooltip>
              )}
            </SortableActionBarItem>
          ))}
          {read.error ? <RendererReadNotice error={read.error} retry={() => void read.retry()} /> : null}
        </Stack>
      </ScrollArea>
      <ActionBarDragPreview label={items.find((item) => item.id === drag.activeId)?.label} />
    </DndContext>
  );
};
