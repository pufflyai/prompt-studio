import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import { QuestionPromptControls } from "./chat-input-question-prompt";
import { useQuestionPromptState } from "./use-question-prompt-state";

const prompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "filter",
      question: "How many tags can the sidebar filter by?",
      required: true,
      options: [{ label: "One tag at a time (recommended)" }, { label: "Several tags at once" }],
    },
    {
      id: "assumptions",
      question: "Tick each assumption you accept",
      multiple: true,
      options: [
        { label: "A note can have several tags, and names ignore case and spaces" },
        { label: "Tags come from existing notes, with no separate tag list" },
      ],
    },
    { id: "notes", question: "Corrections or other answers", options: [] },
  ],
};
interface QuestionFormProps {
  prompt: ChatInputQuestionPrompt;
}
// The chat composer's question form, used outside the chat with the caller's own buttons.
function QuestionForm(props: QuestionFormProps) {
  const { prompt } = props;
  const question = useQuestionPromptState(prompt);
  const [answers, setAnswers] = useState<string[][]>();
  return (
    <Stack gap="sm">
      <QuestionPromptControls
        isEditable
        questionPrompt={prompt}
        selectedOptionsByQuestion={question.selectedOptionsByQuestion}
        customAnswersByQuestion={question.customAnswersByQuestion}
        onToggleOption={question.toggleOption}
        onToggleOther={question.toggleOther}
        onCustomAnswerChange={question.setCustomAnswer}
      />
      <Button
        alignSelf="start"
        size="sm"
        disabled={question.hasMissingRequiredAnswer}
        onClick={() => setAnswers(question.buildAnswers())}
      >
        Submit answer
      </Button>
      {answers ? <Text textStyle="label/S/regular">{JSON.stringify(answers)}</Text> : null}
    </Stack>
  );
}
const meta: CanvasMeta<typeof QuestionForm> = {
  title: "Patterns/Chat/Question form",
  component: QuestionForm,
  decorators: [
    (Story) => (
      <Box maxW="2xl" p="md">
        <Story />
      </Box>
    ),
  ],
  args: { prompt },
};
export default meta;
type Story = CanvasFrame<typeof QuestionForm>;
export const StepTabs: Story = {
  id: "patterns-chat-question-form--step-tabs",
};
export const SingleQuestion: Story = {
  id: "patterns-chat-question-form--single-question",
  args: { prompt: { questions: [prompt.questions[0]] } },
};
