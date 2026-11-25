import { Button, HStack, IconButton, Stack, Text, useRecipe } from "@chakra-ui/react";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import {
  EmptyState,
  psTheme,
  ResizableSplitLayout,
  ScrollArea,
  Tooltip,
  TreeList,
  type TreeListNode,
} from "@pstdio/ui";
import { useRef } from "react";
import { EditingError } from "../../editing-error";
import { ExampleIcon } from "../../icon";
import type { ExampleViewInput } from "../../view-context";
import type { MarmaladeAction, MarmaladeState } from "./marmalade.types";
import { useMarmaladeInspectorSize } from "./marmalade-inspector-size";
import { marmaladeLocked, selectedBlock, selectedRoots } from "./marmalade-layers";
import { MarmaladePreview } from "./marmalade-preview";
import { MarmaladeProperties } from "./marmalade-properties";
import { MarmaladeSelectionProperties } from "./marmalade-selection-properties";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

const layerNodes = (state: MarmaladeState, dispatch: (action: MarmaladeAction) => void, parentId?: string) => {
  const nodes: TreeListNode[] = [];
  for (const layer of state.document.layers.filter((layer) => layer.parentId === parentId)) {
    nodes.push({
      id: layer.id,
      label: (
        <Text color={layer.visible ? "fg" : "fg.muted"} textStyle="label/S/regular" truncate>
          {layer.name}
        </Text>
      ),
      startContent: <MarmaladePreview layer={layer} />,
      disabled: layer.disabled,
      isContainer: layer.kind === "group",
      canDrag: !marmaladeLocked(state, layer),
      canDrop: !layer.disabled,
      children: layer.kind === "group" ? layerNodes(state, dispatch, layer.id) : undefined,
      actionsVisibility: "always",
      actions: [
        {
          id: "visibility",
          label: `${layer.visible ? "Hide" : "Show"} ${layer.name}`,
          icon: <ExampleIcon name={layer.visible ? "Eye" : "EyeOff"} />,
          pressed: layer.visible,
          disabled: layer.disabled,
          onAction: () => dispatch({ type: "visibility", id: layer.id, visible: !layer.visible }),
        },
        {
          id: "lock",
          label: `${layer.locked ? "Unlock" : "Lock"} ${layer.name}`,
          icon: <ExampleIcon name={layer.locked ? "Lock" : "LockOpen"} />,
          pressed: layer.locked,
          disabled: layer.disabled,
          onAction: () => dispatch({ type: "lock", id: layer.id, locked: !layer.locked }),
        },
      ],
    });
  }
  return nodes;
};

export const MarmaladeInspector = ({ input }: { input: ExampleViewInput }) => {
  const visible = useWebviewVisibility();
  // Retained host views stay mounted offscreen. Retire transient controls when their view leaves.
  return visible ? <MarmaladeInspectorContent input={input} /> : null;
};

const isResizeHandle = (target: EventTarget) => target instanceof Element && target.closest('[role="separator"]');

const MarmaladeInspectorContent = ({ input }: { input: ExampleViewInput }) => {
  const layout = useMarmaladeInspectorSize(input);
  const resizePointer = useRef<number | undefined>(undefined);
  const keyboardResize = useRef(false);
  const state = useMarmalade((projection) => projection.state);
  const error = useMarmalade((projection) => projection.error);
  const buttonRecipe = useRecipe({ recipe: psTheme.getRecipe("button") });
  const layer = state.document.layers.find((item) => item.id === state.selectedIds[0]);
  const dispatch = (action: MarmaladeAction) => {
    void marmaladeStore.dispatch(action);
  };
  const roots = selectedRoots(state);
  const protectedSelection = selectedBlock(state).some((item) => marmaladeLocked(state, item));
  const actions = [
    { type: "duplicate", label: "Duplicate layers", icon: "Copy", disabled: !roots.length || protectedSelection },
    { type: "group", label: "Group layers", icon: "FolderPlus", disabled: roots.length < 2 || protectedSelection },
    {
      type: "ungroup",
      label: "Ungroup layers",
      icon: "Ungroup",
      disabled: !roots.length || !roots.every((item) => item.kind === "group") || protectedSelection,
    },
    { type: "delete", label: "Delete layers", icon: "Trash2", disabled: !roots.length || protectedSelection },
  ] as const;
  return (
    <Stack h="full" minH="0" gap="0" bg="bg.panel" aria-label="Marmalade inspector">
      {error ? <EditingError error={error} retry={() => marmaladeStore.retry()} /> : null}
      {layout.error ? <EditingError error={layout.error} retry={layout.retry} /> : null}
      <ResizableSplitLayout
        h="full"
        minH="0"
        resizableSide="bottom"
        defaultSizePx={layout.size}
        minSizePx={96}
        contentMinSizePx={160}
        collapsible={false}
        resizeLabel="Resize layers group"
        onPointerDownCapture={(event) => {
          const handle = isResizeHandle(event.target);
          if (event.button !== 0 || !handle) return;
          const activePointer = resizePointer.current;
          if (activePointer !== undefined && handle.hasPointerCapture(activePointer)) return;
          resizePointer.current = event.pointerId;
        }}
        onPointerUpCapture={(event) => {
          if (resizePointer.current === event.pointerId) resizePointer.current = undefined;
        }}
        onKeyDownCapture={(event) => {
          keyboardResize.current = Boolean(isResizeHandle(event.target));
        }}
        onKeyDown={() => {
          keyboardResize.current = false;
        }}
        onSizeChange={(size) => {
          // The shared layout also reports sizes while cleaning up an interrupted pointer drag.
          if (resizePointer.current === undefined || keyboardResize.current) layout.save(size);
        }}
        contentPanel={
          <Stack h="full" minH="0" gap="0">
            <Text textStyle="label/S/medium" px="sm" py="sm" flexShrink="0">
              Properties
            </Text>
            <ScrollArea flex="1" minH="0">
              {state.selectedIds.length > 1 ? <MarmaladeSelectionProperties state={state} /> : null}
              {state.selectedIds.length === 1 && layer ? (
                <MarmaladeProperties key={layer.id} state={state} layer={layer} />
              ) : null}
              {!layer && (
                <Text px="sm" textStyle="label/XS" color="fg.muted">
                  Select a layer to edit its properties.
                </Text>
              )}
            </ScrollArea>
          </Stack>
        }
        resizablePanel={
          <Stack h="full" minH="0" gap="0">
            <HStack px="sm" py="sm" gap="2xs">
              <Text textStyle="label/S/medium">Layers</Text>
              <HStack flex="1" justify="flex-end" gap="2xs">
                <Tooltip content="Add text layer">
                  <IconButton
                    aria-label="Add text layer"
                    variant="ghost"
                    size="xs"
                    onClick={() => dispatch({ type: "create", kind: "text", x: 100, y: 100 })}
                  >
                    <ExampleIcon name="Type" />
                  </IconButton>
                </Tooltip>
                {actions.map((action) => (
                  <Tooltip key={action.type} content={action.label}>
                    <IconButton
                      aria-label={action.label}
                      size="xs"
                      variant="ghost"
                      css={
                        action.type === "delete"
                          ? buttonRecipe({ variant: "destructive-ghost", size: "xs" })
                          : undefined
                      }
                      disabled={action.disabled}
                      onClick={() => dispatch({ type: action.type })}
                    >
                      <ExampleIcon name={action.icon} />
                    </IconButton>
                  </Tooltip>
                ))}
              </HStack>
            </HStack>
            <ScrollArea flex="1" minH="0">
              {state.document.layers.length ? (
                <TreeList
                  sections={[{ id: "layers", nodes: layerNodes(state, dispatch) }]}
                  rowVariant="tree"
                  activeNodeId={state.selectedIds}
                  expandedNodeIds={state.expandedIds}
                  onSelectionChange={(ids) => dispatch({ type: "select", ids })}
                  moveSelection
                  onToggleNode={(id) => dispatch({ type: "expand", id })}
                  onMoveNode={(source, target, position = "inside") =>
                    dispatch({ type: "reorder", source, target, position })
                  }
                />
              ) : (
                <EmptyState title="No layers">
                  <Button onClick={() => dispatch({ type: "reset" })}>Restore sample</Button>
                </EmptyState>
              )}
            </ScrollArea>
          </Stack>
        }
      />
    </Stack>
  );
};
