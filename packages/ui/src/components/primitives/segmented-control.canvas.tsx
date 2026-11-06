import { Box, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { SegmentedControl } from "./segmented-control";

type StoryFn = () => ReactNode;
const selectionModes = [
  { value: "single_select", label: "Single" },
  { value: "multi_select", label: "Multiple" },
];
const meta = {
  title: "Design system/Components/Forms/Segmented control",
  component: SegmentedControl,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg">
        <Story />
      </Box>
    ),
  ],
};
export default {
  title: "Design system/Components/Forms/Segmented control",
  fullscreen: true,
};
const Default = {
  id: "components-inputs-segmented-control--default",
  render: () => {
    const [value, setValue] = useState("single_select");
    return (
      <SegmentedControl options={selectionModes} value={value} onValueChange={setValue} aria-label="Selection mode" />
    );
  },
};

const Sizes = {
  id: "components-inputs-segmented-control--sizes",
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
const Disabled = {
  id: "components-inputs-segmented-control--disabled",
  render: () => (
    <SegmentedControl options={selectionModes} value="single_select" disabled onValueChange={() => undefined} />
  ),
};

const Examples = createCanvasExampleNavigator(meta, { Default, Sizes, Disabled });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
