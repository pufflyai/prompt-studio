// Draw one ticket card in the graph: gate marker, shorthand, status, and title.
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { DropIndicator, ResourceContextMenu, Tooltip } from "@pstdio/ui";
import { collectDisplayBadges, KanbanRendererCard } from "@pstdio/ui/kanban-renderer";
import { ShieldCheck } from "lucide-react";
import type { PlanRow } from "../contracts";
import { card } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import type { Relation } from "./plan-view";
import { TicketCardError, type TicketCardInteraction, useTicketCardActions } from "./ticket-card-interaction";

interface GraphCardProps {
  row: PlanRow;
  x: number;
  y: number;
  relation?: Relation;
  dropBefore: boolean;
  interaction?: TicketCardInteraction;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: () => void;
  onDrop: () => void;
}

export function GraphCard(props: GraphCardProps) {
  const { row, x, y, relation, dropBefore, interaction, ...actions } = props;
  const source = interaction?.rows.get(row.id);
  const menu = useTicketCardActions(interaction, source);
  const fields = interaction?.attributes ?? [];
  const statusBadges = row.status
    ? [{ attributeId: "status", label: row.status.name, icon: row.status.icon, color: row.status.color }]
    : [];
  const badges = source
    ? collectDisplayBadges(
        source,
        fields,
        fields
          .filter(
            (field) =>
              field.displayable && field.editable && (field.type.kind === "enum" || field.type.kind === "enum-multi"),
          )
          .map(({ id }) => id),
      )
    : statusBadges;
  const activate = () => {
    if (interaction) void interaction.host.call("navigation.open", { target: row.target });
    else actions.onSelect(row.id);
  };
  const waiting = row.flags.includes("waiting");
  let opacity = 1;
  if (waiting) opacity = 0.8;
  if (row.done) opacity = 0.6;
  return (
    <ResourceContextMenu actions={menu.actions} keepMountedWhenEmpty>
      <Box
        data-ticket={row.id}
        role="button"
        tabIndex={0}
        aria-label={`${row.shorthand} ${row.title}`}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            activate();
          }
        }}
        position="absolute"
        left={`${x}px`}
        top={`${y}px`}
        w={`${card.width}px`}
        zIndex={relation ? graphLayers.hierarchyNode : graphLayers.node}
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
        {/* The shared placement indicator marks the insertion point in the gap above the card. */}
        {dropBefore ? <DropIndicator top="-12px" /> : null}
        <KanbanRendererCard
          eyebrow={[...row.ancestors, row].map(({ shorthand }) => shorthand).join("/")}
          title={row.title}
          isSelected={relation === "selected"}
          badges={badges}
          onBadgeChange={interaction ? menu.onBadgeChange : undefined}
          customSlots={[row.gate ? <GateMark key="gate" /> : null]}
          onClick={activate}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.id);
            actions.onDragStart(row.id);
          }}
        />
        <TicketCardError error={menu.error} />
      </Box>
    </ResourceContextMenu>
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
