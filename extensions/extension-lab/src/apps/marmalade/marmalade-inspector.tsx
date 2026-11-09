import { Button, HStack, IconButton, Stack, Text, useRecipe } from "@chakra-ui/react";
import { EmptyState, psTheme, ScrollArea, Tooltip, TreeList, type TreeListNode } from "@pstdio/ui";
import { ExampleIcon } from "../../icon";
import type { MarmaladeAction, MarmaladeState } from "./marmalade.types";
import { marmaladeLocked, selectedBlock, selectedRoots } from "./marmalade-layers";
import { MarmaladePreview } from "./marmalade-preview";
import { MarmaladeProperties } from "./marmalade-properties";
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

export const MarmaladeInspector = () => {
  const { state, error } = useMarmalade();
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
      <ScrollArea flex="1" minH="0">
        {layer ? <MarmaladeProperties key={layer.id} state={state} layer={layer} /> : null}
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
                    action.type === "delete" ? buttonRecipe({ variant: "destructive-ghost", size: "xs" }) : undefined
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
        {error ? (
          <Text role="alert" px="sm" color="fg.error" textStyle="label/XS">
            {error}
          </Text>
        ) : null}
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
  );
};
