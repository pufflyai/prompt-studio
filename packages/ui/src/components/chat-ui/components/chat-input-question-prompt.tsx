import { HStack, Stack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import {
  type ChatInputQuestion,
  type ChatInputQuestionCustomAnswers,
  type ChatInputQuestionPrompt,
  getQuestionPromptSignature,
  getQuestionSelectionKey,
  isQuestionOtherSelected,
} from "./chat-input-question-answers";
import { QuestionStepTab } from "./chat-input-question-step-tab";
import { getOwnQuestionValue } from "./question-choices";
import { QuestionFormBlockView } from "./timeline-tool-blocks";

export * from "./chat-input-question-answers";

interface QuestionPromptControlsProps {
  questionPrompt: ChatInputQuestionPrompt;
  selectedOptionsByQuestion: Record<string, string[]>;
  customAnswersByQuestion: ChatInputQuestionCustomAnswers;
  onToggleOption: (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => void;
  onToggleOther: (question: ChatInputQuestion, questionIndex: number) => void;
  onCustomAnswerChange: (question: ChatInputQuestion, questionIndex: number, answer: string) => void;
}

interface QuestionPromptStepperProps extends QuestionPromptControlsProps {
  questions: ReturnType<typeof toQuestionFormQuestions>;
}

const toQuestionFormQuestions = (questionPrompt: ChatInputQuestionPrompt) =>
  questionPrompt.questions.map((question, index) => ({
    id: getQuestionSelectionKey(question, index),
    question: question.question,
    options: question.options,
    multiple: Boolean(question.multiple),
    required: Boolean(question.required),
    allowCustomAnswer: Boolean(question.allowCustomAnswer),
  }));

const QuestionPromptStepper = (props: QuestionPromptStepperProps) => {
  const { questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion, onToggleOption, onCustomAnswerChange } =
    props;
  const { onToggleOther } = props;
  const { questions } = props;
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const questionPanelRef = useRef<HTMLDivElement>(null);
  const renderQuestionIndex = Math.min(activeQuestionIndex, questions.length - 1);
  const activeQuestion = questions[renderQuestionIndex];
  const hasMultipleQuestions = questions.length > 1;

  return (
    <Stack gap="xs" pb="sm" pt={hasMultipleQuestions ? "0" : "xs"}>
      {hasMultipleQuestions ? (
        <HStack role="tablist" aria-label="Question steps" gap="1" minWidth="0">
          {questions.map((question, questionIndex) => (
            <QuestionStepTab
              key={question.id}
              question={question}
              questionIndex={questionIndex}
              isActive={questionIndex === renderQuestionIndex}
              selectedOptionsByQuestion={selectedOptionsByQuestion}
              customAnswersByQuestion={customAnswersByQuestion}
              onSelectStep={setActiveQuestionIndex}
            />
          ))}
        </HStack>
      ) : null}
      <Stack
        ref={questionPanelRef}
        tabIndex={-1}
        id={`question-step-panel-${activeQuestion.id}`}
        role={hasMultipleQuestions ? "tabpanel" : undefined}
        aria-labelledby={hasMultipleQuestions ? `question-step-tab-${activeQuestion.id}` : undefined}
        gap="0"
      >
        <QuestionFormBlockView
          questions={[activeQuestion]}
          editable
          selectedOptionsByQuestion={selectedOptionsByQuestion}
          customAnswersByQuestion={customAnswersByQuestion}
          onToggleOption={(_question, _questionIndex, optionLabel) => {
            const question = questionPrompt.questions[renderQuestionIndex];
            const selectedOptions = getOwnQuestionValue(selectedOptionsByQuestion, activeQuestion.id) ?? [];
            const hadSelection =
              selectedOptions.length > 0 ||
              isQuestionOtherSelected(customAnswersByQuestion, question, renderQuestionIndex);

            onToggleOption(question, renderQuestionIndex, optionLabel);
            // Advance after the first listed radio choice. Stay when editing an answer or choosing Other
            // so the person can finish their answer; checkboxes and the last step never advance automatically.
            if (!question.multiple && !hadSelection && renderQuestionIndex < questions.length - 1) {
              // Keep keyboard focus in the panel while the previous question's controls are removed.
              questionPanelRef.current?.focus();
              setActiveQuestionIndex(renderQuestionIndex + 1);
            }
          }}
          onToggleOther={() => {
            onToggleOther(questionPrompt.questions[renderQuestionIndex], renderQuestionIndex);
          }}
          onCustomAnswerChange={(_question, _questionIndex, answer) => {
            onCustomAnswerChange(questionPrompt.questions[renderQuestionIndex], renderQuestionIndex, answer);
          }}
        />
      </Stack>
    </Stack>
  );
};

export const QuestionPromptControls = (props: QuestionPromptControlsProps) => {
  const { questionPrompt } = props;
  const questions = toQuestionFormQuestions(questionPrompt);
  const questionPromptSignature = getQuestionPromptSignature(questionPrompt);

  return <QuestionPromptStepper key={questionPromptSignature} {...props} questions={questions} />;
};
