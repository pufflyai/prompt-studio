import { Box, Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";

const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Patterns/Chat/Question navigation",
  component: ChatPanel,
  tags: ["!manifest"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = CanvasVariant<typeof ChatPanel>;
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
  id: "patterns-chat-question-navigation--first-radio-choice-advances",
  render: () => (
    <Box w="32rem" h="24rem">
      <ChatPanel
        chatInputPlaceholder="Write a prompt"
        emptyStateDescription="Send a prompt"
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
};
export const KeyboardRadioChoiceAdvances: Story = {
  id: "patterns-chat-question-navigation--keyboard-radio-choice-advances",
  ...FirstRadioChoiceAdvances,
};
export const StepTooltipFollowsStep: Story = {
  id: "patterns-chat-question-navigation--step-tooltip-follows-step",
  ...FirstRadioChoiceAdvances,
};
