import { Box, Stack, Text, Wrap } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { renderBadgeListDisplay } from "./kanban-renderer-helpers";
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
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LinkedResources: Story = {
  render: () => <LinkedBadgeList />,
};
