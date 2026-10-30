import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { HarnessParamEditor } from "./harness-param-editor";
import type { HarnessParamValues } from "./harness-param-values";
import { ParamEditor } from "./param-editor";
import type { SelectionParam } from "./param-editor.types";

const codexSchema = {
  collaboration_mode: {
    type: "select" as const,
    control: "command" as const,
    label: "Collaboration",
    defaultValue: "default",
    options: [
      { label: "Default", value: "default" },
      { label: "Planning", value: "plan" },
    ],
  },
  model_reasoning_effort: {
    type: "select" as const,
    label: "Reasoning effort",
    defaultValue: "medium",
    options: [
      { label: "None", value: "none", icon: "CircleSlash" },
      { label: "Minimal", value: "minimal", icon: "level-low" },
      { label: "Low", value: "low", icon: "level-low" },
      { label: "Medium", value: "medium", icon: "level-mid" },
      { label: "High", value: "high", icon: "level-high" },
      { label: "XHigh", value: "xhigh", icon: "level-xhigh" },
      { label: "Max", value: "max", icon: "flame" },
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
    { id: "worktree", name: "Worktree", icon: "git-branch" },
    { id: "current_branch", name: "Current branch", icon: "git-commit-horizontal" },
  ],
};

const HarnessParamEditorStory = (props: {
  initial?: HarnessParamValues;
  defaults?: HarnessParamValues;
  schema?: typeof codexSchema;
  showCommandParams?: boolean;
}) => {
  const { initial, defaults, schema, showCommandParams } = props;
  const [overrides, setOverrides] = useState<HarnessParamValues>(initial ?? {});

  return (
    <Box maxW="640px" p="4" bg="bg" borderWidth="1px" borderColor="border.subtle">
      <HarnessParamEditor
        schema={schema ?? codexSchema}
        defaults={defaults ?? { model_reasoning_effort: "medium", model_reasoning_summary: "auto", dryRun: false }}
        showCommandParams={showCommandParams}
        overrides={overrides}
        onOverridesChange={setOverrides}
      />
    </Box>
  );
};

const meta: Meta<typeof HarnessParamEditorStory> = {
  title: "Components/Param Editor/Harness run options",
  component: HarnessParamEditorStory,
};

export default meta;

type Story = StoryObj<typeof HarnessParamEditorStory>;

export const Defaults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Collaboration", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Default", exact: true }));
    await userEvent.click(await within(document.body).findByRole("menuitemradio", { name: "Planning" }));
    await expect(canvas.getByRole("button", { name: "Planning", exact: true })).toBeVisible();
  },
};

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
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
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
  args: { showCommandParams: false },
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

    await waitFor(() => expect(body.getByRole("button", { name: "GPT-5.3 Codex" })).toBeVisible());
    await expect(body.getByRole("button", { name: "PS-10_A1" })).toBeVisible();
    await expect(body.queryByText("Collaboration", { exact: true })).not.toBeInTheDocument();

    await userEvent.click(body.getByRole("button", { name: "Medium" }));

    const option = await body.findByRole("menuitemradio", { name: "High" });
    const bounds = option.getBoundingClientRect();
    const topMostElement = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    await expect(option.contains(topMostElement)).toBe(true);

    await userEvent.click(option);
    await expect(body.getByRole("button", { name: "High" })).toBeVisible();
  },
};
