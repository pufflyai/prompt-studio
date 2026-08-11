import { Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ParamEditor } from "./param-editor";
import type { ParamValueMap } from "./param-editor.types";

const meta = {
  title: "Patterns/Param Editor/Searchable Grouped Selection",
  component: ParamEditor,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ParamEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunAttemptForm: Story = {
  render: (props) => {
    const [values, setValues] = useState<ParamValueMap>(props.defaultValues ?? {});

    return (
      <Container padding="md">
        <ParamEditor
          {...props}
          defaultValues={values}
          onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        />
      </Container>
    );
  },
  args: {
    defaultValues: {
      harness: "codex",
      model: "gpt-5.3-codex",
      repository: "prompt-studio",
      workspace: "PS-10_A1",
      reasoningEffort: "medium",
      mode: "worktree",
    },
    onChange: () => {},
    params: [
      {
        id: "model",
        name: "Model",
        type: "selection",
        defaultValue: "gpt-5.3-codex",
        placeholder: "Select model",
        searchable: true,
        searchPlaceholder: "Search models…",
        emptyText: "No models found",
        options: [
          { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", icon: "Cpu", description: "Latest Codex model" },
          { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", icon: "Cpu" },
          { id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", icon: "Cpu" },
        ],
        group: {
          id: "harness",
          name: "Harness",
          defaultValue: "codex",
          placeholder: "Select harness",
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
          options: [
            { id: "prompt-studio", name: "prompt-studio", icon: "FolderGit2" },
            { id: "sdk", name: "sdk", icon: "FolderGit2" },
          ],
        },
      },
      {
        id: "reasoningEffort",
        name: "Reasoning effort",
        type: "selection",
        defaultValue: "medium",
        options: [
          { id: "minimal", name: "Minimal", icon: "CircleDot" },
          { id: "low", name: "Low", icon: "Gauge" },
          { id: "medium", name: "Medium", icon: "Brain" },
          { id: "high", name: "High", icon: "Zap" },
          { id: "xhigh", name: "Extra high", icon: "Flame" },
        ],
      },
      {
        id: "mode",
        name: "Mode",
        type: "selection",
        defaultValue: "worktree",
        options: [
          { id: "worktree", name: "Worktree", icon: "GitFork" },
          { id: "current-branch", name: "Current branch", icon: "GitBranch" },
        ],
      },
    ],
    readOnly: false,
  },
};
