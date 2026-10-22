// Draw one ticket card in the graph: gate marker, shorthand, status, and title.
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { DropIndicator, ResourceContextMenu, Tooltip } from "@pstdio/ui";
import {
  collectDisplayBadges,
  getAttributeValue,
  KanbanRendererCard,
  renderBadgeListDisplay,
} from "@pstdio/ui/kanban-renderer";
import { ShieldCheck } from "lucide-react";
import type { TicketWorkspaceBadgeItem } from "../../data/mappers";
import { DEFAULT_TIMELINE_DISPLAY_PROPERTIES } from "../../data/ticket-board";
import type { PlanRow } from "../contracts";
import { card } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import type { Relation } from "./plan-view";
import { NeedsAttentionIcon, ReviewStatusIcon } from "./status-icon";
import { TicketCardError, type TicketCardInteraction, useTicketCardActions } from "./ticket-card-interaction";

interface GraphCardProps {
  row: PlanRow;
  x: number;
  y: number;
  relation?: Relation;
  dropBefore: boolean;
  interaction?: TicketCardInteraction;
  onSelect: (id: string) => void;
  onOpenRequests?: (row: PlanRow) => void;
  onDragStart: (id: string) => void;
  onDragOver: () => void;
  onDrop: () => void;
}

export function GraphCard(props: GraphCardProps) {
  const { row, x, y, relation, dropBefore, interaction, ...actions } = props;
  const source = interaction?.rows.get(row.id);
  const menu = useTicketCardActions(interaction, source);
  const fields = interaction?.attributes ?? [];
  const properties = interaction?.displayProperties ?? DEFAULT_TIMELINE_DISPLAY_PROPERTIES;
  const statusBadges = row.status
    ? [{ attributeId: "status", label: row.status.name, icon: row.status.icon, color: row.status.color }]
    : [];
  const badges = source
    ? collectDisplayBadges(
        source,
        fields,
        properties.filter((id) => !["id", "needsAttention", "reviewRequests"].includes(id)),
      )
    : statusBadges;
  const slots = source
    ? fields
        .filter(
          ({ id, displayable }) =>
            displayable &&
            !["needsAttention", "reviewRequests"].includes(id) &&
            interaction?.displayProperties.includes(id),
        )
        .map((field) =>
          renderBadgeListDisplay(field, getAttributeValue(source, field), source, undefined, (id) => {
            const items = source.attributes[field.display!.itemsAttributeId] as TicketWorkspaceBadgeItem[];
            const target = items.find((item) => item.id === id)?.target;
            return target ? () => void interaction?.host.call("navigation.open", { target }) : undefined;
          }),
        )
    : [];
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
          eyebrow={
            !interaction || interaction.displayProperties.includes("id")
              ? [...row.ancestors, row].map(({ shorthand }) => shorthand).join("/")
              : undefined
          }
          title={row.title}
          isSelected={relation === "selected"}
          badges={badges}
          onBadgeChange={interaction ? menu.onBadgeChange : undefined}
          customSlots={[
            ...slots,
            properties.includes("needsAttention") ? <NeedsAttentionIcon key="attention" row={row} /> : null,
            properties.includes("reviewRequests") ? (
              <ReviewStatusIcon
                key="review"
                row={row}
                onOpen={actions.onOpenRequests ? () => actions.onOpenRequests?.(row) : undefined}
              />
            ) : null,
            row.gate ? <GateMark key="gate" /> : null,
          ]}
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
