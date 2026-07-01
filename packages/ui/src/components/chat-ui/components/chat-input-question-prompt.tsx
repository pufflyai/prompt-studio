import { Button, HStack, Stack } from "@chakra-ui/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { QuestionFormBlockView } from "./timeline-tool-blocks";

export interface ChatInputQuestionOption {
  label: string;
  description?: string;
}

export interface ChatInputQuestion {
  id?: string;
  question: string;
  options: ChatInputQuestionOption[];
  multiple?: boolean;
  required?: boolean;
  allowCustomAnswer?: boolean;
}

export interface ChatInputQuestionPrompt {
  questions: ChatInputQuestion[];
}

export interface ChatInputQuestionResponse {
  answers: string[][];
}

export type ChatInputQuestionCustomAnswers = Record<string, string>;

interface QuestionPromptControlsProps {
  questionPrompt: ChatInputQuestionPrompt;
  selectedOptionsByQuestion: Record<string, string[]>;
  customAnswersByQuestion: ChatInputQuestionCustomAnswers;
  onToggleOption: (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => void;
  onCustomAnswerChange: (question: ChatInputQuestion, questionIndex: number, answer: string) => void;
}

interface QuestionPromptStepperProps extends QuestionPromptControlsProps {
  questions: ReturnType<typeof toQuestionFormQuestions>;
}

export const getQuestionSelectionKey = (question: ChatInputQuestion, index: number) =>
  question.id ?? `question-${index}`;

export const getQuestionPromptSignature = (questionPrompt: ChatInputQuestionPrompt | undefined) => {
  if (!questionPrompt) return "";

  return JSON.stringify(
    questionPrompt.questions.map((question, index) => ({
      id: getQuestionSelectionKey(question, index),
      question: question.question,
      multiple: Boolean(question.multiple),
      required: Boolean(question.required),
      allowCustomAnswer: Boolean(question.allowCustomAnswer),
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description ?? "",
      })),
    })),
  );
};

const getQuestionAnswerLines = (
  questionPrompt: ChatInputQuestionPrompt,
  selectedOptionsByQuestion: Record<string, string[]>,
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
) => {
  const lines: string[] = [];

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    const key = getQuestionSelectionKey(question, index);
    const selectedLabels = selectedOptionsByQuestion[key] ?? [];
    const customAnswer = customAnswersByQuestion[key]?.trim();
    const answers = customAnswer ? [...selectedLabels, customAnswer] : selectedLabels;
    if (answers.length === 0) continue;

    lines.push(`${question.question}: ${answers.join(", ")}`);
  }

  return lines;
};

const isCustomAnswersByQuestion = (
  value: ChatInputQuestionCustomAnswers | string,
): value is ChatInputQuestionCustomAnswers => typeof value !== "string";

const toCustomAnswersByQuestion = (
  questionPrompt: ChatInputQuestionPrompt,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (isCustomAnswersByQuestion(answerInput)) return answerInput;

  const trimmed = answerInput.trim();
  if (trimmed.length === 0) return {};

  const answers: ChatInputQuestionCustomAnswers = {};
  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    if (!question.allowCustomAnswer) continue;
    answers[getQuestionSelectionKey(question, index)] = trimmed;
  }

  return answers;
};

export const buildQuestionResponse = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (!questionPrompt) return typeof answerInput === "string" ? answerInput.trim() : "";

  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);
  const lines = getQuestionAnswerLines(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion);
  const legacyText = typeof answerInput === "string" ? answerInput.trim() : "";
  const hasCustomQuestions = questionPrompt.questions.some((question) => question.allowCustomAnswer);

  if (legacyText.length > 0 && !hasCustomQuestions) {
    lines.push(`Additional response: ${legacyText}`);
  }

  return lines.join("\n");
};

export const buildQuestionAnswerValues = (
  questionPrompt: ChatInputQuestionPrompt,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);

  return questionPrompt.questions.map((question, index) => {
    const key = getQuestionSelectionKey(question, index);
    const selectedLabels = selectedOptionsByQuestion[key] ?? [];
    const customAnswer = customAnswersByQuestion[key]?.trim();
    return customAnswer ? [...selectedLabels, customAnswer] : selectedLabels;
  });
};

export const hasMissingRequiredQuestionAnswer = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (!questionPrompt) return false;

  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    if (!question.required) continue;

    const key = getQuestionSelectionKey(question, index);
    const hasSelectedOption = (selectedOptionsByQuestion[key] ?? []).length > 0;
    if (hasSelectedOption) continue;
    if (question.allowCustomAnswer && customAnswersByQuestion[key]?.trim()) continue;

    return true;
  }

  return false;
};

const toQuestionFormQuestions = (questionPrompt: ChatInputQuestionPrompt) =>
  questionPrompt.questions.map((question, index) => ({
    id: getQuestionSelectionKey(question, index),
    question: question.question,
    options: question.options,
    multiple: Boolean(question.multiple),
    required: Boolean(question.required),
    allowCustomAnswer: Boolean(question.allowCustomAnswer),
  }));

type QuestionFormQuestion = ReturnType<typeof toQuestionFormQuestions>[number];

interface QuestionStepTabProps {
  question: QuestionFormQuestion;
  sourceQuestion: ChatInputQuestion;
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
  return (selectedOptionsByQuestion[key] ?? []).length > 0 || Boolean(customAnswersByQuestion[key]?.trim());
};

const QuestionStepTab = (props: QuestionStepTabProps) => {
  const {
    question,
    sourceQuestion,
    questionIndex,
    isActive,
    selectedOptionsByQuestion,
    customAnswersByQuestion,
    onSelectStep,
  } = props;
  const isAnswered = hasQuestionAnswer(
    sourceQuestion,
    questionIndex,
    selectedOptionsByQuestion,
    customAnswersByQuestion,
  );
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

const QuestionPromptStepper = (props: QuestionPromptStepperProps) => {
  const { questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion, onToggleOption, onCustomAnswerChange } =
    props;
  const { questions } = props;
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const renderQuestionIndex = Math.min(activeQuestionIndex, questions.length - 1);
  const activeQuestion = questions[renderQuestionIndex];
  const hasMultipleQuestions = questions.length > 1;

  return (
    <Stack gap="xs" pb="sm">
      {hasMultipleQuestions ? (
        <HStack role="tablist" aria-label="Question steps" gap="1" minWidth="0">
          {questions.map((question, questionIndex) => (
            <QuestionStepTab
              key={question.id}
              question={question}
              sourceQuestion={questionPrompt.questions[questionIndex]}
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
            onToggleOption(questionPrompt.questions[renderQuestionIndex], renderQuestionIndex, optionLabel);
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
