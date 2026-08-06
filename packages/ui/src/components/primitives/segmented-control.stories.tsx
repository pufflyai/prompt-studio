import { Box, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { SegmentedControl } from "./segmented-control";

type StoryFn = () => ReactNode;

const selectionModes = [
  { value: "single_select", label: "Single" },
  { value: "multi_select", label: "Multiple" },
];

const meta = {
  title: "Components/Inputs/Segmented Control",
  component: SegmentedControl,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => {
    const [value, setValue] = useState("single_select");

    return (
      <SegmentedControl options={selectionModes} value={value} onValueChange={setValue} aria-label="Selection mode" />
    );
  },
};

export const Sizes = {
  render: () => {
    const [value, setValue] = useState("multi_select");

    return (
      <Stack gap="sm" alignItems="flex-start">
        <SegmentedControl size="sm" options={selectionModes} value={value} onValueChange={setValue} />
        <SegmentedControl size="xs" options={selectionModes} value={value} onValueChange={setValue} />
      </Stack>
    );
  },
};

export const Disabled = {
  render: () => (
    <SegmentedControl options={selectionModes} value="single_select" disabled onValueChange={() => undefined} />
  ),
};
