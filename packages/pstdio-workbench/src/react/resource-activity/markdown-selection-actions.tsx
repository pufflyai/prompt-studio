import { IconButton } from "@chakra-ui/react";
import { editorSlots } from "@pstdio/sdk/extensions";
import { AlertMessage, ScopedPopover as Popover, Portal, resolveIconComponent, Tooltip } from "@pstdio/ui";
import { useMarkdownEditor } from "@pstdio/ui/rich-text";
import { CircleHelp, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { editorSelectionMenuPath } from "../../core";
import { resolveMenuEntries } from "../menus/menu-entries";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import type { useMarkdownActivity } from "./markdown-activity";
import { MarkdownCommentComposer, type PassageCommentDraft } from "./markdown-comment-composer";

export const ResourceMarkdownSelectionActions = (props: {
  workbench: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  documentPath?: string;
  activity: ReturnType<typeof useMarkdownActivity>;
}) => {
  const { workbench, placement, documentPath, activity } = props;
  const editor = useMarkdownEditor();
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState<PassageCommentDraft>();
  const [actionError, setActionError] = useState<{ message: string; rect: DOMRect }>();
  const returnFocus = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => activity?.registerReveal(editor.reveal), [activity?.registerReveal, editor.reveal]);
  const actions = resolveMenuEntries({
    workbench,
    menuPath: editorSelectionMenuPath,
    context: { resource: placement?.resource, placement: placement?.placementIdentity },
  });
  const close = (restoreFocus = false) => {
    if (restoreFocus) returnFocus.current = true;
    setDraft(undefined);
    editor.clearHighlight();
  };
  const restoreEditorFocus = () => {
    if (!returnFocus.current) return;
    returnFocus.current = false;
    editor.focus();
  };
  return (
    <>
      {actions.map((action) => (
        <Tooltip key={action.id} content={action.disabledReason ?? action.label}>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={action.label}
            disabled={action.disabled || !action.run}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const selection = editor.captureSelection();
              if (!selection) return;
              const { text, start, end } = selection;
              const captured = resolveMenuEntries({
                workbench,
                menuPath: editorSelectionMenuPath,
                onRequestParams: ({ request }) => workbench.commandPalette.requestParams(request),
                context: {
                  resource: placement?.resource,
                  placement: placement?.placementIdentity,
                  slot: {
                    id: editorSlots.selection.id,
                    kind: "menu",
                    context: { selection: { text, start, end, ...(documentPath && { documentPath }) } },
                  },
                },
              }).find((entry) => entry.id === action.id);
              setActionError(undefined);
              void captured?.run?.().catch((error) =>
                setActionError({
                  message: error instanceof Error ? error.message : String(error),
                  rect: selection.rect,
                }),
              );
            }}
          >
            {action.icon && resolveIconComponent(action.icon) ? <WorkbenchIcon name={action.icon} /> : <CircleHelp />}
          </IconButton>
        </Tooltip>
      ))}
      {activity && (
        <Popover.Root
          open={Boolean(draft)}
          onEscapeKeyDown={(event) => {
            if (publishing) event.preventDefault();
            else returnFocus.current = true;
          }}
          onInteractOutside={(event) => {
            if (publishing) event.preventDefault();
          }}
          onOpenChange={({ open }) => {
            if (publishing) return;
            if (!open) return close();
            const selection = editor.captureSelection();
            if (!selection?.anchor) return;
            editor.reveal(selection.anchor);
            setDraft({ selection: editor.captureSelection() ?? selection, body: "", key: crypto.randomUUID() });
          }}
          onExitComplete={restoreEditorFocus}
          initialFocusEl={() => content.current?.querySelector<HTMLElement>('[role="textbox"]') ?? null}
          positioning={{
            placement: "bottom-start",
            strategy: "fixed",
            getAnchorRect: () => draft?.selection.rect ?? null,
          }}
        >
          <Tooltip content="Comment">
            <Popover.Trigger asChild>
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="Comment"
                disabled={publishing}
                onMouseDown={(event) => event.preventDefault()}
              >
                <MessageSquare />
              </IconButton>
            </Popover.Trigger>
          </Tooltip>
          <Portal>
            <Popover.Positioner>
              <Popover.Content ref={content} aria-label="Comment on selection" w="popover-panel" maxW="full">
                {draft && (
                  <MarkdownCommentComposer
                    draft={draft}
                    busy={publishing}
                    onBusyChange={setPublishing}
                    onChange={setDraft}
                    onClose={() => close(true)}
                    onPosted={() => close()}
                    publish={activity.publish}
                  />
                )}
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      )}
      {actionError && (
        <Popover.Root
          open
          onExitComplete={restoreEditorFocus}
          positioning={{ placement: "bottom-start", strategy: "fixed", getAnchorRect: () => actionError.rect }}
          onOpenChange={({ open }) => {
            if (!open) setActionError(undefined);
          }}
        >
          <Portal>
            <Popover.Positioner>
              <Popover.Content>
                <AlertMessage status="error" title="Could not open action">
                  {actionError.message}
                </AlertMessage>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      )}
    </>
  );
};
