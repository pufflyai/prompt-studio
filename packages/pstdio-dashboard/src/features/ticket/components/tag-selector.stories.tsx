import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { TagSelector } from "./tag-selector";

const meta: Meta<typeof TagSelector> = {
  title: "Ticket/TagSelector",
  component: TagSelector,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof TagSelector>;

const SAMPLE_TAGS = [
  { id: "tag-1", name: "Bug", color: "red" as const },
  { id: "tag-2", name: "Feature", color: "blue" as const },
  { id: "tag-3", name: "Improvement", color: "green" as const },
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
    selectedTagIds: ["tag-1", "tag-3"],
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
    selectedTagIds: ["tag-2"],
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
    selectedTagIds: ["tag-1"],
  },
  render: (args) => (
    <Box maxW="360px" p="sm">
      <TagSelector {...args} />
    </Box>
  ),
};
