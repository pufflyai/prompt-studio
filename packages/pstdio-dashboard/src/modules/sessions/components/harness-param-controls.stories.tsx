import { Box, Dialog, Portal, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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

// The run attempt modal renders these controls inside a dialog; their portalled menus have to
// stay on top of it, otherwise every option click lands on the dialog instead.
export const InsideDialog: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Dialog.Root open modal size="lg">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Run attempt</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="md">
                  <Text textStyle="label/S/medium">Model</Text>
                  <Story />
                </Stack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    ),
  ],
  play: async () => {
    const body = within(document.body);

    await userEvent.click(body.getByRole("button", { name: "Reasoning effort: Medium" }));

    const option = await body.findByRole("menuitem", { name: "High" });
    const bounds = option.getBoundingClientRect();
    const topMostElement = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    await expect(option.contains(topMostElement)).toBe(true);

    await userEvent.click(option);
    await expect(body.getByRole("button", { name: "Reasoning effort: High" })).toBeVisible();
  },
};
