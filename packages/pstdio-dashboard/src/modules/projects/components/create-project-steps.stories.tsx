import type { Meta, StoryObj } from "@storybook/react";
import { HarnessesStep } from "./create-project-steps";

const meta = {
  title: "Projects/CreateProject/HarnessesStep",
  component: HarnessesStep,
  parameters: { layout: "centered" },
} satisfies Meta<typeof HarnessesStep>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DetectedFirst: Story = {
  args: {
    harnesses: [
      { id: "pstdio.harness-codex.harness.codex", name: "Codex", availability: { type: "INSTALLED" } },
      {
        id: "pstdio.harness-claude-code.harness.claude-code",
        name: "Claude Code",
        availability: { type: "INSTALLED" },
      },
      { id: "pstdio.harness-open-code.harness.opencode", name: "OpenCode", availability: { type: "NOT_FOUND" } },
    ],
    selectedAgentIds: ["pstdio.harness-codex.harness.codex", "pstdio.harness-claude-code.harness.claude-code"],
    hasAgentError: false,
    isWorking: false,
    isAgentsLoading: false,
    showAgentError: false,
    onAgentToggle: () => undefined,
  },
};
