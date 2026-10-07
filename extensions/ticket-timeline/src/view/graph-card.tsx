// Draw one ticket card in the graph: gate marker, shorthand, status, and title.
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { PanelsTopLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { PlanRow } from "../contracts";
import { nodeSize } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import type { Relation } from "./plan-view";
import { StatusIcon } from "./status-icon";

interface GraphCardProps {
  row: PlanRow;
  x: number;
  y: number;
  relation?: Relation;
  dropBefore: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: () => void;
  onDrop: () => void;
  preview?: ReactNode;
}

function borderColor(relation: Relation | undefined) {
  if (relation === "selected") {
    return "fg";
  }

  return relation ? "fg.muted" : "border";
}

export function GraphCard({ row, x, y, relation, dropBefore, preview, ...actions }: GraphCardProps) {
  const ready = row.state === "not-started";
  const border = !relation && ready ? "green.muted" : borderColor(relation);
  const size = nodeSize(row);
  return (
    <Box
      data-ticket={row.id}
      role="button"
      tabIndex={0}
      aria-label={`${row.shorthand} ${row.title}`}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          actions.onSelect(row.id);
        }
      }}
      position="absolute"
      left={`${x}px`}
      top={`${y}px`}
      w={`${size.width}px`}
      h={`${size.height}px`}
      zIndex={relation ? graphLayers.hierarchyNode : graphLayers.node}
      px="sm"
      py="xs"
      bg={row.gate ? "bg.subtle" : "bg"}
      borderWidth="1px"
      borderColor={row.gate && !relation ? "border.accent/40" : border}
      borderStyle={row.gate ? "dashed" : "solid"}
      borderRadius="md"
      outline={dropBefore ? "1px solid" : "none"}
      outlineColor="border.accent/60"
      outlineOffset="3px"
      opacity={row.done ? 0.6 : 1}
      cursor="grab"
      draggable
      title={`${row.shorthand} ${row.title}`}
      onClick={() => actions.onSelect(row.id)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.id);
        actions.onDragStart(row.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.onDrop();
      }}
    >
      <Flex align="center" gap="xs" h="20px">
        {row.gate ? <GateMark /> : null}
        {row.artifact ? <Icon as={PanelsTopLeft} color="fg.accent" boxSize="14px" aria-label="Artifact node" /> : null}
        <Text textStyle="label/S/medium" color="fg.muted">
          {row.shorthand}
        </Text>
        <StatusIcon row={row} />
      </Flex>
      <Text textStyle="label/S/regular" lineClamp={2} color={row.done ? "fg.muted" : "fg"}>
        {row.title}
      </Text>
      {row.artifact ? preview : null}
    </Box>
  );
}

function GateMark() {
  return (
    <Tooltip content="Agent gate · review dependencies and update the plan">
      <Flex role="img" aria-label="Agent gate" tabIndex={0} gap="2xs" color="fg.accent">
        <Icon as={ShieldCheck} boxSize="14px" />
        <Text textStyle="label/XS/medium">GATE</Text>
      </Flex>
    </Tooltip>
  );
}
