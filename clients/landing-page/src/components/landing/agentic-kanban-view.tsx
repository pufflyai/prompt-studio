import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { KanbanRendererBoard, KanbanRendererCard, type KanbanRendererCardProps } from "@pstdio/ui/kanban-renderer";
import { CircleDashed, Columns3, Plus, SlidersHorizontal } from "lucide-react";

interface RoadmapTicket {
  id: string;
  title: string;
  tag: "design" | "platform";
}

interface RoadmapColumn {
  id: string;
  label: string;
  color: string;
  icon: string;
  tickets: RoadmapTicket[];
}

const ROADMAP_COLUMNS: RoadmapColumn[] = [
  {
    id: "backlog",
    label: "Backlog",
    color: "gray",
    icon: "circle-dashed",
    tickets: [
      { id: "PS-171", title: "Bubblify the side panel across resources", tag: "design" },
      { id: "PS-168", title: "Saved filters for collection views", tag: "design" },
      { id: "PS-165", title: "Extension-declared mode layouts", tag: "platform" },
    ],
  },
  {
    id: "todo",
    label: "Todo",
    color: "gray",
    icon: "circle",
    tickets: [
      { id: "PS-161", title: "Inherit workspace terminal cwd", tag: "platform" },
      { id: "PS-158", title: "Chat scroll jumps while streaming", tag: "design" },
    ],
  },
  {
    id: "in-progress",
    label: "In progress",
    color: "yellow",
    icon: "loader-circle",
    tickets: [
      { id: "PS-122", title: "Show sidebar shortcuts at rest", tag: "design" },
      { id: "PS-130", title: "Harness run parameters", tag: "platform" },
      { id: "PS-94", title: "Split planner loops into an extension", tag: "platform" },
    ],
  },
  {
    id: "in-review",
    label: "In review",
    color: "green",
    icon: "circle-check",
    tickets: [
      { id: "PS-151", title: "Improve chat and data tables", tag: "design" },
      { id: "PS-134", title: "Feature-slice @pstdio/ui", tag: "design" },
    ],
  },
];

const ticketCardProps = (ticket: RoadmapTicket): KanbanRendererCardProps => ({
  eyebrow: ticket.id,
  title: ticket.title,
  badges: [
    {
      attributeId: "team",
      label: ticket.tag,
      color: ticket.tag === "design" ? "purple" : "blue",
      icon: "tag",
    },
  ],
});

const MOBILE_TICKETS = ROADMAP_COLUMNS.find((column) => column.id === "in-progress")?.tickets ?? [];

const MobileKanban = () => (
  <Stack display={{ base: "flex", md: "none" }} height="100%" gap="0" px="11px" pt="16px" pb="71px">
    <Text as="h1" fontFamily="heading" fontSize="20px" fontWeight="semibold">
      Release plan
    </Text>
    <Text fontFamily="mono" fontSize="8px" letterSpacing="0.5px" color="fg.subtle" mt="2px">
      Project Roadmap
    </Text>
    <HStack mt="22px" justify="space-between">
      <HStack gap="7px">
        <Box width="8px" height="8px" bg="yellow.400" rounded="full" />
        <Text fontFamily="mono" fontSize="9px" fontWeight="semibold" letterSpacing="1px">
          IN PROGRESS
        </Text>
      </HStack>
      <Text fontFamily="body" fontSize="10px" color="fg.muted">
        3 of 10 tickets
      </Text>
    </HStack>
    <Stack gap="7px" mt="21px">
      {MOBILE_TICKETS.map((ticket) => (
        <KanbanRendererCard key={ticket.id} {...ticketCardProps(ticket)} />
      ))}
    </Stack>
  </Stack>
);

const ROADMAP_BOARD_COLUMNS = ROADMAP_COLUMNS.map((column) => ({
  id: column.id,
  label: column.label,
  color: column.color,
  icon: column.icon,
  items: column.tickets.map((ticket) => ({ id: ticket.id, cardProps: ticketCardProps(ticket) })),
  canDragIn: false,
  canDragOut: false,
  canCreate: false,
  actions: [],
}));

const DesktopKanban = () => (
  <Stack height="100%" minWidth="0" gap="0" display={{ base: "none", md: "flex" }}>
    <HStack height="40px" flexShrink="0" px="12px" gap="6px" borderBottomWidth="1px" borderColor="border">
      {["Release plan", "My work", "Backlog", "Blocked"].map((label, index) => (
        <HStack
          key={label}
          height="25px"
          px="10px"
          gap="7px"
          bg={index === 0 ? "bg.hover" : "transparent"}
          borderWidth="1px"
          borderColor="border"
          rounded="4px"
          color={index === 0 ? "fg" : "fg.muted"}
        >
          {index === 0 ? <Columns3 size={13} /> : <CircleDashed size={13} />}
          <Text fontFamily="body" fontSize="11px">
            {label}
          </Text>
        </HStack>
      ))}
      <Plus size={14} />
      <Flex flex="1" />
      <SlidersHorizontal size={15} />
    </HStack>
    <Box flex="1" minHeight="0">
      <KanbanRendererBoard columns={ROADMAP_BOARD_COLUMNS} />
    </Box>
  </Stack>
);

export const AgenticKanbanView = () => (
  <Box height="100%">
    <DesktopKanban />
    <MobileKanban />
  </Box>
);
