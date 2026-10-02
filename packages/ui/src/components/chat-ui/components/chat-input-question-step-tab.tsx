import { Button } from "@chakra-ui/react";
import { Check } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";
import {
  type ChatInputQuestion,
  type ChatInputQuestionCustomAnswers,
  getAnswersForQuestion,
  getQuestionSelectionKey,
} from "./chat-input-question-answers";

interface QuestionStepTabProps {
  question: ChatInputQuestion;
  questionIndex: number;
  isActive: boolean;
  selectedOptionsByQuestion: Record<string, string[]>;
  customAnswersByQuestion: ChatInputQuestionCustomAnswers;
  onSelectStep: (questionIndex: number) => void;
}

const hasQuestionAnswer = (
  question: ChatInputQuestion,
  questionIndex: number,
  selectedOptionsByQuestion: Record<string, string[]>,
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
) => {
  const key = getQuestionSelectionKey(question, questionIndex);
  // The same rule the send guard uses, so a ticked step always matches what the form would send.
  return getAnswersForQuestion(question, key, selectedOptionsByQuestion, customAnswersByQuestion).length > 0;
};

export const QuestionStepTab = (props: QuestionStepTabProps) => {
  const { question, questionIndex, isActive, selectedOptionsByQuestion, customAnswersByQuestion, onSelectStep } = props;
  const isAnswered = hasQuestionAnswer(question, questionIndex, selectedOptionsByQuestion, customAnswersByQuestion);
  const stepStateLabel = isAnswered ? "answered" : "not answered";
  const tabVariant = isActive ? "outline" : "ghost";

  return (
    <Tooltip content={question.question}>
      <Button
        id={`question-step-tab-${question.id}`}
        role="tab"
        aria-label={`${question.question} (${stepStateLabel})`}
        aria-selected={isActive}
        aria-controls={`question-step-panel-${question.id}`}
        size="xs"
        variant={tabVariant}
        minW="8"
        onClick={() => onSelectStep(questionIndex)}
      >
        {isAnswered ? <Check aria-hidden="true" /> : questionIndex + 1}
      </Button>
    </Tooltip>
  );
};
