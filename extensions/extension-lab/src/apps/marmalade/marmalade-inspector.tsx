import { Box, Button, chakra, HStack, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea, TreeList, type TreeListNode } from "@pstdio/ui";
import { ExampleIcon } from "../../icon";
import type { MarmaladeAction, MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { marmaladeLocked } from "./marmalade-document";
import { MarmaladePreview } from "./marmalade-preview";
import { MarmaladePropertyInput } from "./marmalade-property-input";
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

const MarmaladeProperties = (props: { state: MarmaladeState; layer: MarmaladeLayer }) => {
  const { state, layer } = props;
  const disabled = marmaladeLocked(state, layer);
  const dispatch = (action: MarmaladeAction) => {
    void marmaladeStore.dispatch(action);
  };
  return (
    <Stack gap="sm" p="sm" borderBottomWidth="1px" borderColor="border.subtle">
      <Text textStyle="label/S/medium">Properties · {layer.name}</Text>
      <HStack gap="sm">
        {(["x", "y"] as const).map((axis) => (
          <Stack key={axis} gap="2xs" flex="1" minW="0">
            <chakra.label htmlFor={`photo-${axis}`} color="fg.muted" textStyle="label/XS">
              {axis.toUpperCase()}
            </chakra.label>
            <MarmaladePropertyInput
              id={`photo-${axis}`}
              label={`Layer ${axis.toUpperCase()}`}
              type="number"
              value={layer[axis]}
              disabled={disabled}
              onEdit={(raw) => {
                const value = Number(raw);
                if (raw && Number.isFinite(value)) dispatch({ type: "position", id: layer.id, [axis]: value });
              }}
            />
          </Stack>
        ))}
      </HStack>
      <HStack gap="sm">
        <chakra.label htmlFor="photo-opacity" textStyle="label/XS" color="fg.muted">
          Opacity
        </chakra.label>
        <MarmaladePropertyInput
          id="photo-opacity"
          label="Layer opacity"
          type="number"
          min={0}
          max={100}
          value={Math.round(layer.opacity * 100)}
          disabled={disabled}
          onEdit={(raw) => {
            const value = Number(raw);
            if (raw && Number.isFinite(value)) dispatch({ type: "opacity", id: layer.id, opacity: value / 100 });
          }}
        />
        <Text textStyle="label/XS" color="fg.muted">
          %
        </Text>
      </HStack>
      {layer.kind === "text" ? (
        <Stack gap="2xs">
          <chakra.label htmlFor="photo-text" textStyle="label/XS" color="fg.muted">
            Text
          </chakra.label>
          <MarmaladePropertyInput
            id="photo-text"
            label="Layer text"
            value={layer.text ?? ""}
            disabled={disabled}
            onEdit={(text) => dispatch({ type: "text", id: layer.id, text })}
          />
        </Stack>
      ) : null}
      {disabled ? (
        <Text textStyle="label/XS" color="fg.muted">
          Locked layers remain readable. Unlock their group to edit.
        </Text>
      ) : null}
    </Stack>
  );
};

export const MarmaladeInspector = () => {
  const { state, error } = useMarmalade();
  const layer = state.document.layers.find((item) => item.id === state.selectedIds[0]);
  const dispatch = (action: MarmaladeAction) => {
    void marmaladeStore.dispatch(action);
  };
  return (
    <Stack h="full" minH="0" gap="0" bg="bg.panel" aria-label="Marmalade inspector">
      <ScrollArea flex="1" minH="0">
        {layer ? <MarmaladeProperties key={layer.id} state={state} layer={layer} /> : null}
        <HStack px="sm" py="sm" justify="space-between">
          <Text textStyle="label/S/medium">Layers</Text>
          <Text color="fg.muted" textStyle="label/XS">
            {state.selectedIds.length} selected
          </Text>
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
            onToggleNode={(id) => dispatch({ type: "expand", id })}
            onMoveNode={(source, target, position = "inside") =>
              dispatch({ type: "reorder", source, target, position })
            }
          />
        ) : (
          <EmptyState title="No layers" description="Restore the sample to start editing.">
            <Button onClick={() => dispatch({ type: "reset" })}>Restore sample</Button>
          </EmptyState>
        )}
        <Box p="sm">
          <Text color="fg.muted" textStyle="label/XS">
            Ctrl/Cmd-click to select several layers. Shift-click selects a visible range. Alt+↑/↓ moves the selected
            layers together. Drag to an edge or inside a group.
          </Text>
        </Box>
      </ScrollArea>
    </Stack>
  );
};
