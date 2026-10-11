// Draw one ticket card in the graph: gate marker, shorthand, status, and title.
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { KanbanRendererCard } from "@pstdio/ui/kanban-renderer";
import { ShieldCheck } from "lucide-react";
import type { PlanRow } from "../contracts";
import { card } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import type { Relation } from "./plan-view";
import { ReviewStatusIcon, StatusIcon } from "./status-icon";

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
}

export function GraphCard(props: GraphCardProps) {
  const { row, x, y, relation, dropBefore, ...actions } = props;
  const waiting = row.flags.includes("waiting");
  let opacity = 1;
  if (waiting) opacity = 0.8;
  if (row.done) opacity = 0.6;
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
      w={`${card.width}px`}
      zIndex={relation ? graphLayers.hierarchyNode : graphLayers.node}
      outline={dropBefore ? "1px solid" : "none"}
      outlineColor="bg.accent-primary.default"
      outlineOffset="3px"
      opacity={opacity}
      title={`${row.shorthand} ${row.title}`}
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
      <KanbanRendererCard
        eyebrow={[...row.ancestors, row].map(({ shorthand }) => shorthand).join("/")}
        title={row.title}
        isSelected={relation === "selected"}
        customSlots={[
          <StatusIcon key="status" row={row} />,
          <ReviewStatusIcon key="review" row={row} />,
          row.gate ? <GateMark key="gate" /> : null,
        ]}
        onClick={() => actions.onSelect(row.id)}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", row.id);
          actions.onDragStart(row.id);
        }}
      />
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
