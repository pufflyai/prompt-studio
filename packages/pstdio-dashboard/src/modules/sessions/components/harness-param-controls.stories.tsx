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
      { label: "Minimal", value: "minimal", icon: "CircleDot" },
      { label: "Low", value: "low", icon: "Gauge" },
      { label: "Medium", value: "medium", icon: "Brain" },
      { label: "High", value: "high", icon: "Zap" },
    ],
  },
  model_reasoning_summary: {
    type: "select" as const,
    label: "Summary",
    defaultValue: "auto",
    options: [
      { label: "Auto", value: "auto", icon: "Sparkles" },
      { label: "Concise", value: "concise", icon: "AlignLeft" },
      { label: "Detailed", value: "detailed", icon: "FileText" },
    ],
  },
  dryRun: {
    type: "boolean" as const,
    label: "Dry run",
    defaultValue: false,
  },
};

const HarnessParamControlsStory = (props: {
  initial?: HarnessParamValues;
  defaults?: HarnessParamValues;
  schema?: typeof codexSchema;
}) => {
  const [overrides, setOverrides] = useState<HarnessParamValues>(props.initial ?? {});

  return (
    <Box maxW="640px" p="4" bg="bg" borderWidth="1px" borderColor="border.subtle">
      <HarnessParamControls
        schema={props.schema ?? codexSchema}
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

export const ModelSpecificEffortLevels: Story = {
  args: {
    schema: {
      ...codexSchema,
      model_reasoning_effort: {
        ...codexSchema.model_reasoning_effort,
        defaultValue: "high",
        options: [
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
        ],
      },
    },
    defaults: { model_reasoning_effort: "high", model_reasoning_summary: "auto", dryRun: false },
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box w="240px">
        <Story />
      </Box>
    ),
  ],
};
