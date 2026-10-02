import type { Meta, StoryObj } from "@storybook/react";
import { AlertMessage } from "@/components/primitives/alert";
import { HarnessControls } from "./harness-controls";

const meta: Meta<typeof HarnessControls> = {
  title: "Patterns/Chat/Harness Controls",
  component: HarnessControls,
  args: {
    query: "/",
    commands: [
      { name: "/plan", description: "Select native planning.", argumentHelp: "[task]" },
      { name: "/compact", description: "Compact this thread." },
    ],
    modes: [],
    onInsert: () => {},
    onLiteralChange: () => {},
    onAction: async () => {},
  },
};
export default meta;
type Story = StoryObj<typeof HarnessControls>;
export const CommandCompletion: Story = {};
export const IndependentModes: Story = {
  args: {
    query: "",
    modes: [
      {
        id: "planning",
        label: "Planning",
        description: "Selected for the next turn.",
        state: "Next turn",
        actions: [{ id: "default", label: "Leave planning" }],
      },
      {
        id: "goal",
        label: "Goal",
        description: "Finish the migration and verify the result.",
        state: "active · 1200 / 40000 tokens",
        actions: [
          { id: "pause", label: "Pause" },
          { id: "edit", label: "Edit", argument: { label: "Objective", value: "Finish the migration" } },
          { id: "clear", label: "Clear" },
        ],
      },
    ],
  },
};
export const Pending: Story = { args: { ...IndependentModes.args, pending: true } };
export const LiteralInput: Story = { args: { query: "/goal is an example", literal: true } };
export const NativeError: Story = {
  render: (args) => (
    <>
      <AlertMessage status="error" title="Command not sent">
        This harness does not support this command. Your draft is ready to edit or send as a message.
      </AlertMessage>
      <HarnessControls {...args} />
    </>
  ),
  args: { query: "/unknown" },
};
