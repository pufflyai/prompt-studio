import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { TicketTag } from "@/features/ticket-list/types";
import { TagSelector } from "./tag-selector";

const meta: Meta<typeof TagSelector> = {
  title: "Ticket/TagSelector",
  component: TagSelector,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof TagSelector>;

const SAMPLE_TAGS: TicketTag[] = [
  {
    id: "tag-label",
    name: "Label",
    type: "single_select",
    options: [
      { id: "opt-1", name: "Bug", color: "red", sortOrder: 1, icon: null, description: null },
      { id: "opt-2", name: "Feature", color: "blue", sortOrder: 2, icon: null, description: null },
      { id: "opt-3", name: "Improvement", color: "green", sortOrder: 3, icon: null, description: null },
    ],
  },
];

const InteractiveStory = () => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  return (
    <Box maxW="360px" p="sm">
      <TagSelector tags={SAMPLE_TAGS} selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
    </Box>
  );
};

export const Default: Story = {
  render: () => <InteractiveStory />,
};

export const WithPreselectedTags: Story = {
  args: {
    tags: SAMPLE_TAGS,
    selectedTagIds: ["opt-1", "opt-3"],
    onChange: () => {},
  },
  render: (args) => (
    <Box maxW="360px" p="sm">
      <TagSelector {...args} />
    </Box>
  ),
};

export const NoTags: Story = {
  args: {
    tags: [],
    selectedTagIds: [],
  },
  render: (args) => (
    <Box maxW="360px" p="sm">
      <TagSelector {...args} />
    </Box>
  ),
};

export const Disabled: Story = {
  args: {
    tags: SAMPLE_TAGS,
    selectedTagIds: ["opt-2"],
    isDisabled: true,
    onChange: () => {},
  },
  render: (args) => (
    <Box maxW="360px" p="sm">
      <TagSelector {...args} />
    </Box>
  ),
};

export const ReadOnly: Story = {
  args: {
    tags: SAMPLE_TAGS,
    selectedTagIds: ["opt-1"],
  },
  render: (args) => (
    <Box maxW="360px" p="sm">
      <TagSelector {...args} />
    </Box>
  ),
};
