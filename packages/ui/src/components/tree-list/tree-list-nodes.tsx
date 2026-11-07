import { Box, Stack } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import type { TreeListNode } from "./tree-list.types";
import type { TreeListDropIndicator } from "./tree-list-drop-indicator";
import { getNodeChildren } from "./tree-list-model";
import { TreeListNodeRow } from "./tree-list-node-row";
import { TreeListReveal } from "./tree-list-reveal";
import { canStartTreeListDrag, DropLine, SortableHost } from "./tree-list-sortable-host";

interface TreeListNodesProps
  extends Omit<ComponentProps<typeof TreeListNodeRow>, "node" | "level" | "onFocus" | "tabIndex"> {
  nodes: TreeListNode[];
  level?: number;
  focusRowId?: string;
  onRowFocus?: (id: string) => void;
  sortable?: boolean;
  indicator?: TreeListDropIndicator | null;
}

const TreeListNodeBranch = (props: TreeListNodesProps & { node: TreeListNode }) => {
  const { node, nodes: _nodes, level = 0, focusRowId, onRowFocus, sortable, indicator = null, ...rowProps } = props;
  const children = getNodeChildren(node);
  let tabIndex: number | undefined;
  if (focusRowId !== undefined) tabIndex = node.id === focusRowId ? 0 : -1;
  const row = (
    <TreeListNodeRow
      {...rowProps}
      node={node}
      level={level}
      tabIndex={tabIndex}
      onFocus={() => onRowFocus?.(node.id)}
    />
  );
  const descendants = children.length ? (
    <TreeListReveal open={rowProps.expandedNodeIds.includes(node.id)}>
      <Box pt={rowProps.nodeGap}>
        <TreeListNodes {...props} nodes={children} level={level + 1} />
      </Box>
    </TreeListReveal>
  ) : null;

  if (sortable && level === 0) {
    return (
      <Box position="relative" minW="0">
        <SortableHost
          id={node.id}
          disabled={node.canReorder === false}
          indicator={indicator?.edge === "after" ? null : indicator}
          handle="child"
          liftedBg="bg.hover"
        >
          {(listeners) => (
            <Box
              onPointerDownCapture={(event) => {
                if (canStartTreeListDrag(event.target)) listeners?.onPointerDown?.(event);
              }}
            >
              {row}
            </Box>
          )}
        </SortableHost>
        {descendants}
        {indicator?.lineId === node.id && indicator.edge === "after" ? <DropLine edge="after" /> : null}
      </Box>
    );
  }
  return (
    <Box position="relative" minW="0">
      {row}
      {descendants}
      {indicator?.lineId === node.id ? <DropLine edge={indicator.edge} /> : null}
    </Box>
  );
};

export const TreeListNodes = (props: TreeListNodesProps) => {
  const { nodes, nodeGap } = props;
  return (
    <Stack gap={nodeGap} w="full" minW="0">
      {nodes.map((node) => (
        <TreeListNodeBranch key={node.id} {...props} node={node} />
      ))}
    </Stack>
  );
};
