import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { BadgeContext, Ticket, TicketGroup, TicketStatusColor } from "../types";
import { TicketsListView } from "./tickets-list-view";

const meta: Meta<typeof TicketsListView> = {
  title: "Tickets/TicketsListView",
  component: TicketsListView,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof TicketsListView>;

const makeTicket = (input: {
  id: string;
  shorthand: string;
  title: string;
  status: string;
  statusColor: TicketStatusColor;
  tagIds?: string[];
}) =>
  ({
    id: input.id,
    shorthand: input.shorthand,
    title: input.title,
    content: "",
    tagIds: input.tagIds ?? [],
    status: input.status,
    statusColor: input.statusColor,
    updatedAt: "2026-05-31T00:00:00.000Z",
  }) satisfies Ticket;

const buildGroups = (reviewColor: TicketStatusColor): TicketGroup[] => [
  {
    id: "Backlog",
    label: "Backlog",
    color: "gray",
    canDragIn: true,
    canDragOut: true,
    canCreate: true,
    columnActions: [],
    tickets: [
      makeTicket({
        id: "ticket-1",
        shorthand: "PS-1",
        title: "Triage status palette",
        status: "Backlog",
        statusColor: "gray",
        tagIds: ["tag-bug"],
      }),
    ],
  },
  {
    id: "Review",
    label: "Review",
    color: reviewColor,
    canDragIn: true,
    canDragOut: true,
    canCreate: true,
    columnActions: [],
    tickets: [
      makeTicket({
        id: "ticket-2",
        shorthand: "PS-2",
        title: "Update custom status color",
        status: "Review",
        statusColor: "gray",
      }),
    ],
  },
];

const buildBadgeContext = (reviewColor: TicketStatusColor): BadgeContext => {
  const tags = [{ id: "tag-bug", name: "Bug", color: "red" as const, tagName: "Type" }];

  return {
    statusOptions: [
      { name: "Backlog", color: "gray" },
      { name: "Review", color: reviewColor },
    ],
    tags,
    tagMap: new Map(tags.map((tag) => [tag.id, tag])),
  };
};

const StatusColorHarness = () => {
  const [reviewColor, setReviewColor] = useState<TicketStatusColor>("purple");
  const nextColor = reviewColor === "purple" ? "green" : "purple";

  return (
    <Stack gap="sm" width="640px">
      <Button width="fit-content" size="sm" onClick={() => setReviewColor(nextColor)}>
        Change Review Color
      </Button>
      <Box borderWidth="1px" borderColor="border.muted">
        <TicketsListView
          groups={buildGroups(reviewColor)}
          displayProperties={["status", "tags"]}
          badgeContext={buildBadgeContext(reviewColor)}
        />
      </Box>
    </Stack>
  );
};

export const StatusColorUpdates: Story = {
  render: () => <StatusColorHarness />,
};
