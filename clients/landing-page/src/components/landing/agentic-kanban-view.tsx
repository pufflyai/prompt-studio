import { Badge, Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { CircleDashed, CircleDot, Columns3, Plus, SlidersHorizontal } from "lucide-react";

interface Ticket {
  id: string;
  title: string;
  meta: string;
  color: "blue" | "purple" | "green";
}

const MOBILE_TICKETS: Ticket[] = [
  {
    id: "PS-164",
    title: "Implement mobile workbench layout",
    meta: "Agent running · 2 files changed",
    color: "blue",
  },
  { id: "PS-170", title: "Review navigation states", meta: "Awaiting review · 3 comments", color: "purple" },
  { id: "PS-172", title: "Fix extension filters", meta: "Agent running · 1 file changed", color: "blue" },
];

const BOARD_COLUMNS = [
  {
    label: "Backlog",
    color: "gray",
    tickets: [
      { id: "PS-171", title: "Bubblify the side panel across resources", tag: "design", person: "AH" },
      { id: "PS-168", title: "Saved filters for collection views", tag: "design", person: "MK" },
      { id: "PS-165", title: "Extension-declared mode layouts", tag: "platform", person: "JL" },
    ],
  },
  {
    label: "Todo",
    color: "gray",
    tickets: [
      { id: "PS-161", title: "Inherit workspace terminal cwd", tag: "platform", person: "MK" },
      { id: "PS-158", title: "Chat scroll jumps while streaming", tag: "design", person: "JL" },
    ],
  },
  {
    label: "In progress",
    color: "yellow",
    tickets: [
      { id: "PS-122", title: "Show sidebar shortcuts at rest", tag: "design", person: "AH" },
      { id: "PS-130", title: "Harness run parameters", tag: "platform", person: "MK" },
      { id: "PS-94", title: "Split planner loops into an extension", tag: "platform", person: "AH" },
    ],
  },
  {
    label: "In review",
    color: "green",
    tickets: [
      { id: "PS-151", title: "Improve chat and data tables", tag: "design", person: "JL" },
      { id: "PS-134", title: "Feature-slice @pstdio/ui", tag: "design", person: "AH" },
    ],
  },
] as const;

const MobileTicketCard = (props: { ticket: Ticket }) => {
  const { ticket } = props;

  return (
    <Stack minHeight="116px" gap="0" p="12px" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="8px">
      <HStack justify="space-between">
        <Text fontFamily="mono" fontSize="9px" color="fg.subtle">
          {ticket.id}
        </Text>
        <CircleDot size={10} color={`var(--chakra-colors-${ticket.color}-400)`} />
      </HStack>
      <Text fontFamily="heading" fontSize="14px" fontWeight="medium" mt="10px">
        {ticket.title}
      </Text>
      <Text fontFamily="body" fontSize="10px" color="fg.muted" mt="9px">
        {ticket.meta}
      </Text>
    </Stack>
  );
};

const MobileKanban = () => (
  <Stack display={{ base: "flex", md: "none" }} height="100%" gap="0" px="11px" pt="16px" pb="71px">
    <Text as="h1" fontFamily="heading" fontSize="20px" fontWeight="semibold">
      Agentic kanban
    </Text>
    <Text fontFamily="mono" fontSize="8px" letterSpacing="0.5px" color="fg.subtle" mt="2px">
      release-plan
    </Text>
    <HStack mt="22px" justify="space-between">
      <HStack gap="7px">
        <Box width="8px" height="8px" bg="blue.300" rounded="full" />
        <Text fontFamily="mono" fontSize="9px" fontWeight="semibold" letterSpacing="1px">
          IN PROGRESS
        </Text>
      </HStack>
      <Text fontFamily="body" fontSize="10px" color="fg.muted">
        2 of 8 tickets
      </Text>
    </HStack>
    <Stack gap="7px" mt="21px">
      {MOBILE_TICKETS.map((ticket) => (
        <MobileTicketCard key={ticket.id} ticket={ticket} />
      ))}
    </Stack>
  </Stack>
);

const BoardTicketCard = (props: { ticket: (typeof BOARD_COLUMNS)[number]["tickets"][number] }) => {
  const { ticket } = props;

  return (
    <Stack minHeight="104px" gap="0" p="10px" bg="bg" borderWidth="1px" borderColor="border" rounded="6px">
      <HStack justify="space-between">
        <Text fontFamily="mono" fontSize="9px" color="fg.subtle">
          {ticket.id}
        </Text>
        <Flex width="18px" height="18px" align="center" justify="center" bg="blue.500" rounded="full">
          <Text fontSize="8px" color="white">
            {ticket.person}
          </Text>
        </Flex>
      </HStack>
      <Text fontFamily="heading" fontSize="12px" lineHeight="1.35" mt="10px">
        {ticket.title}
      </Text>
      <Badge width="fit-content" size="xs" variant="outline" colorPalette="gray" mt="10px">
        {ticket.tag}
      </Badge>
    </Stack>
  );
};

const DesktopKanban = () => (
  <Flex height="100%" display={{ base: "none", md: "flex" }}>
    <Stack flex="1" minWidth="0" gap="0">
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
      <SimpleBoard />
    </Stack>
  </Flex>
);

const SimpleBoard = () => (
  <Flex flex="1" minHeight="0" gap="11px" p="14px" overflowX="auto">
    {BOARD_COLUMNS.map((column) => (
      <Stack
        key={column.label}
        width="calc((100% - 33px) / 4)"
        minWidth="190px"
        gap="8px"
        p="9px"
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        rounded="8px"
      >
        <HStack height="30px" px="2px">
          <CircleDot size={15} color={`var(--chakra-colors-${column.color}-400)`} />
          <Text fontFamily="heading" fontSize="12px" fontWeight="medium">
            {column.label}
          </Text>
          <Badge size="xs" variant="number" colorPalette="gray">
            {column.tickets.length}
          </Badge>
          <Flex flex="1" />
          <Plus size={13} />
        </HStack>
        {column.tickets.map((ticket) => (
          <BoardTicketCard key={ticket.id} ticket={ticket} />
        ))}
      </Stack>
    ))}
  </Flex>
);

export const AgenticKanbanView = () => (
  <Box height="100%">
    <DesktopKanban />
    <MobileKanban />
  </Box>
);
