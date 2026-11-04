import { Box, Stack, Text, Wrap } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { CollectionBadge } from "./collection-badge";
import { KanbanRendererCard } from "./kanban-renderer-card";
import { renderBadgeListDisplay } from "./kanban-renderer-helpers";
import { KanbanRendererListRow } from "./kanban-renderer-list-row";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const descriptor = {
  id: "contributors",
  label: "Contributors",
  type: { kind: "string" },
  display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
} satisfies AttributeDescriptor;
const row = {
  id: "recipe-1",
  title: "Soup",
  attributes: {
    contributors: "ada",
    contributorItems: [
      { id: "ada", label: "Ada", icon: "user", resource: { type: "person", id: "ada" } },
      { id: "lee", label: "Lee", icon: "user", resource: { type: "person", id: "lee" } },
    ],
  },
} satisfies KanbanRendererRow;
const LinkedBadgeList = () => {
  const [opened, setOpened] = useState("None");
  const badges = renderBadgeListDisplay(descriptor, row.attributes.contributors, row, (resource) =>
    setOpened(resource.id),
  );
  return (
    <Stack p="lg" gap="md">
      <Wrap gap="2xs">{badges}</Wrap>
      <Box>
        <Text textStyle="label/S/medium">Opened resource</Text>
        <Text data-testid="opened-resource">{opened}</Text>
      </Box>
    </Stack>
  );
};
const meta = {
  title: "Patterns/Kanban Renderer/Collection badge list",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const LinkedResources: Story = {
  id: "patterns-kanban-renderer-collection-badge-list--linked-resources",
  render: () => <LinkedBadgeList />,
};
export const ReviewRequestCounts: Story = {
  id: "patterns-kanban-renderer-collection-badge-list--review-request-counts",
  render: () => (
    <Wrap p="lg" gap="sm">
      <CollectionBadge
        label="1"
        icon="message-circle-warning"
        color="orange"
        tooltip="1 open review request"
        onClick={() => {}}
      />
      <CollectionBadge
        label="3"
        icon="message-circle-warning"
        color="orange"
        tooltip="3 open review requests"
        onClick={() => {}}
      />
      <CollectionBadge
        label="3"
        icon="message-circle-warning"
        color="green"
        tooltip="All 3 review requests resolved"
        onClick={() => {}}
      />
    </Wrap>
  ),
};

function TicketResourceInteraction(props: { list?: boolean }) {
  const [opened, setOpened] = useState("None");
  const [drags, setDrags] = useState(0);
  const customSlots = [
    <CollectionBadge key="workspace" label="Working copy" icon="folder" onClick={() => setOpened("Workspace")} />,
    <CollectionBadge key="artifact" label="Prototype" icon="file-code" onClick={() => setOpened("Artifact")} />,
    <CollectionBadge key="missing" label="Saved resource" icon="circle-alert" tooltip="Unavailable" />,
  ];
  const item = {
    id: "ticket",
    title: "Open related work",
    draggable: true,
    onClick: () => setOpened("Ticket"),
    customSlots,
  };
  return (
    <Stack maxW={props.list ? "full" : "sm"} gap="md">
      {props.list ? (
        <KanbanRendererListRow
          row={{ id: item.id, item, depth: 0, isGroup: false, canExpand: false }}
          isExpanded={false}
          selectedItemId={null}
          activeDropTargetId={null}
          draggedItemId={null}
          onDraggedItemChange={(id) => {
            if (id) setDrags((count) => count + 1);
          }}
          onDropTargetChange={() => {}}
          onExpandedChange={() => {}}
        />
      ) : (
        <KanbanRendererCard {...item} onDragStart={() => setDrags((count) => count + 1)} />
      )}
      <Text role="status">
        Opened: {opened}; Drags: {drags}
      </Text>
    </Stack>
  );
}

export const TicketResources: Story = { render: () => <TicketResourceInteraction /> };
export const ListResources: Story = { render: () => <TicketResourceInteraction list /> };
