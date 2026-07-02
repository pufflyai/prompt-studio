import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { HarnessParamControls, type HarnessParamValues } from "./harness-param-controls";

const codexSchema = {
  model_reasoning_effort: {
    type: "select" as const,
    label: "Reasoning effort",
    defaultValue: "medium",
    options: [
      { label: "Minimal", value: "minimal" },
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
    ],
  },
  model_reasoning_summary: {
    type: "select" as const,
    label: "Summary",
    defaultValue: "auto",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Concise", value: "concise" },
      { label: "Detailed", value: "detailed" },
    ],
  },
  dryRun: {
    type: "boolean" as const,
    label: "Dry run",
    defaultValue: false,
  },
};

const HarnessParamControlsStory = (props: { initial?: HarnessParamValues; defaults?: HarnessParamValues }) => {
  const [overrides, setOverrides] = useState<HarnessParamValues>(props.initial ?? {});

  return (
    <Box maxW="640px" p="4" bg="bg" borderWidth="1px" borderColor="border.subtle">
      <HarnessParamControls
        schema={codexSchema}
        defaults={
          props.defaults ?? { model_reasoning_effort: "medium", model_reasoning_summary: "auto", dryRun: false }
        }
        overrides={overrides}
        onOverridesChange={setOverrides}
      />
    </Box>
  );
};

const meta: Meta<typeof HarnessParamControlsStory> = {
  title: "Sessions/HarnessParamControls",
  component: HarnessParamControlsStory,
};

export default meta;

type Story = StoryObj<typeof HarnessParamControlsStory>;

export const Defaults: Story = {};

export const WithOverrides: Story = {
  args: {
    initial: { model_reasoning_effort: "high", dryRun: true },
  },
};

export const CustomProjectDefaults: Story = {
  args: {
    defaults: { model_reasoning_effort: "low", model_reasoning_summary: "concise", dryRun: false },
  },
};
