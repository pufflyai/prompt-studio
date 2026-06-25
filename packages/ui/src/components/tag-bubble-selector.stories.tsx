import { Box, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { TagBubbleSelector } from "./tag-bubble-selector";

type StoryFn = () => ReactNode;

const options = [
  { id: "feature", label: "Feature", color: "green", icon: "sparkles" },
  { id: "bug", label: "Bug", color: "red", icon: "bug" },
  { id: "docs", label: "Docs", color: "blue", icon: "file-text" },
];

const meta = {
  title: "Components/Inputs/Tag Bubble Selector",
  component: TagBubbleSelector,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const SingleSelect = {
  render: () => {
    const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(["feature"]);

    return (
      <TagBubbleSelector
        label="Type"
        options={options}
        selectedOptionIds={selectedOptionIds}
        selectionMode="single"
        onSelectedOptionIdsChange={setSelectedOptionIds}
      />
    );
  },
};

export const MultiSelect = {
  render: () => {
    const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(["feature", "docs"]);

    return (
      <HStack>
        <TagBubbleSelector
          label="Tags"
          options={options}
          selectedOptionIds={selectedOptionIds}
          selectionMode="multiple"
          onSelectedOptionIdsChange={setSelectedOptionIds}
        />
      </HStack>
    );
  },
};
