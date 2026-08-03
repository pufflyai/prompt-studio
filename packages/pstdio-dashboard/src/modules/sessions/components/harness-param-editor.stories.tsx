import { Box, Dialog, Portal, Stack } from "@chakra-ui/react";
import { ParamEditor, type SelectionParam } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { HarnessParamEditor } from "./harness-param-editor";
import type { HarnessParamValues } from "./harness-param-values";

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

const runAttemptSelections: SelectionParam[] = [
  {
    id: "model",
    name: "Model",
    type: "selection",
    defaultValue: "gpt-5.3-codex",
    searchable: true,
    searchPlaceholder: "Search models…",
    options: [
      { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", icon: "Cpu" },
      { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", icon: "Cpu" },
    ],
    group: {
      id: "harness",
      name: "Harness",
      defaultValue: "codex",
      options: [
        { id: "codex", name: "Codex", icon: "Terminal" },
        { id: "claude-code", name: "Claude Code", icon: "Terminal" },
      ],
    },
  },
  {
    id: "workspace",
    name: "Workspace",
    type: "selection",
    defaultValue: "PS-10_A1",
    searchable: true,
    searchPlaceholder: "Search workspaces…",
    options: [
      { id: "PS-10_A1", name: "PS-10_A1", icon: "GitBranch" },
      { id: "PS-9_A1", name: "PS-9_A1", icon: "GitBranch" },
    ],
    group: {
      id: "repository",
      name: "Repository",
      defaultValue: "prompt-studio",
      options: [{ id: "prompt-studio", name: "prompt-studio", icon: "FolderGit2" }],
    },
  },
];

const runAttemptMode: SelectionParam = {
  id: "mode",
  name: "Mode",
  type: "selection",
  defaultValue: "worktree",
  options: [
    { id: "worktree", name: "Worktree", icon: "GitFork" },
    { id: "current_branch", name: "Current branch", icon: "GitBranch" },
  ],
};

const HarnessParamEditorStory = (props: {
  initial?: HarnessParamValues;
  defaults?: HarnessParamValues;
  schema?: typeof codexSchema;
}) => {
  const [overrides, setOverrides] = useState<HarnessParamValues>(props.initial ?? {});

  return (
    <Box maxW="640px" p="4" bg="bg" borderWidth="1px" borderColor="border.subtle">
      <HarnessParamEditor
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

const meta: Meta<typeof HarnessParamEditorStory> = {
  title: "Sessions/HarnessParamEditor",
  component: HarnessParamEditorStory,
};

export default meta;

type Story = StoryObj<typeof HarnessParamEditorStory>;

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

// The run attempt modal renders this editor inside a dialog, so its options must remain
// clickable there as well as in a standalone form.
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
                <Stack gap="0">
                  <ParamEditor
                    params={runAttemptSelections}
                    defaultValues={{
                      model: "gpt-5.3-codex",
                      harness: "codex",
                      workspace: "PS-10_A1",
                      repository: "prompt-studio",
                    }}
                  />
                  <Story />
                  <ParamEditor params={[runAttemptMode]} defaultValues={{ mode: "worktree" }} />
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

    await expect(body.getByRole("button", { name: "GPT-5.3 Codex" })).toBeVisible();
    await expect(body.getByRole("button", { name: "PS-10_A1" })).toBeVisible();

    await userEvent.click(body.getByRole("button", { name: "Medium" }));

    const option = await body.findByRole("menuitemradio", { name: "High" });
    const bounds = option.getBoundingClientRect();
    const topMostElement = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    await expect(option.contains(topMostElement)).toBe(true);

    await userEvent.click(option);
    await expect(body.getByRole("button", { name: "High" })).toBeVisible();
  },
};
