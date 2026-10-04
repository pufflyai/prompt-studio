import { Box, Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Question navigation",
  component: ChatPanel,
  tags: ["!manifest"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;

const questionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "greeting",
      question: "Choose a greeting",
      options: [{ label: "Hello" }, { label: "Hi" }],
      required: true,
      allowCustomAnswer: true,
    },
    {
      id: "audience",
      question: "Choose an audience",
      options: [{ label: "World" }, { label: "Team" }],
      required: true,
      allowCustomAnswer: true,
    },
    {
      id: "constraints",
      question: "Select constraints",
      options: [{ label: "Keep API stable" }, { label: "Add tests" }],
      multiple: true,
      required: true,
    },
    {
      id: "delivery",
      question: "Choose delivery",
      options: [{ label: "Now" }, { label: "Later" }],
      required: true,
    },
  ],
};

export const FirstRadioChoiceAdvances: Story = {
  render: () => (
    <Box w="32rem" h="24rem">
      <ChatPanel
        messages={[]}
        emptyStateTitle="Question navigation"
        chatInputQuestionPrompt={questionPrompt}
        actions={
          <Button size="xs" variant="ghost">
            gpt-6.1-sol
          </Button>
        }
        onSubmitMessage={() => {}}
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const expectStep = async (name: string) => {
      await expect(canvas.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    };

    await userEvent.click(canvas.getByText("Hello", { exact: true }));
    await expectStep("Choose an audience (not answered)");
    await expect(canvas.getByRole("tabpanel")).toHaveFocus();

    await userEvent.click(canvas.getByRole("tab", { name: "Choose a greeting (answered)" }));
    await userEvent.click(canvas.getByText("Hi", { exact: true }));
    await expectStep("Choose a greeting (answered)");
    await expect(canvas.getByRole("radio", { name: "Hi", exact: true })).toBeChecked();

    await userEvent.click(canvas.getByRole("tab", { name: "Choose an audience (not answered)" }));
    await userEvent.click(canvas.getByText("Other", { exact: true }));
    await expectStep("Choose an audience (not answered)");
    await userEvent.click(canvas.getByText("World", { exact: true }));
    await expectStep("Choose an audience (answered)");

    await userEvent.click(canvas.getByRole("tab", { name: "Select constraints (not answered)" }));
    await userEvent.click(canvas.getByText("Keep API stable", { exact: true }));
    await expectStep("Select constraints (answered)");

    await userEvent.click(canvas.getByRole("tab", { name: "Choose delivery (not answered)" }));
    await userEvent.click(canvas.getByText("Now", { exact: true }));
    await expectStep("Choose delivery (answered)");
    await expect(canvas.getByRole("button", { name: "Send answer", exact: true })).toBeEnabled();
  },
};

export const KeyboardRadioChoiceAdvances: Story = {
  ...FirstRadioChoiceAdvances,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("radio", { name: "Hello", exact: true }).focus();
    await userEvent.keyboard("[Space]");
    await expect(canvas.getByRole("tabpanel", { name: "Choose an audience (not answered)" })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("radio", { name: "World", exact: true })).toHaveFocus();
    await userEvent.keyboard("[Space]");
    await expect(canvas.getByRole("tabpanel", { name: "Select constraints (not answered)" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard("[Space]");
    await expect(canvas.getByRole("checkbox", { name: "Keep API stable", exact: true })).toBeChecked();
    await expect(canvas.getByRole("tab", { name: "Select constraints (answered)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};
