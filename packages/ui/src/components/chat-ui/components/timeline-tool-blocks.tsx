import { Box, Stack, Text, Textarea } from "@chakra-ui/react";
import type { FormEvent, ReactNode } from "react";
import { Checkbox } from "@/components/primitives/checkbox";
import { Radio, RadioGroup } from "@/components/primitives/radio";
import {
  getOwnQuestionValue,
  OTHER_CHOICE_LABEL,
  OTHER_CHOICE_VALUE,
  questionOffersOtherChoice,
} from "./question-choices";
import type { QuestionFormBlockQuestion, TodoListBlockItem } from "./timeline";

const preventSubmit = (event: FormEvent) => {
  event.preventDefault();
};

interface QuestionFormBlockViewProps {
  questions: QuestionFormBlockQuestion[];
  editable?: boolean;
  selectedOptionsByQuestion?: Record<string, string[]>;
  customAnswersByQuestion?: Record<string, string>;
  onToggleOption?: (question: QuestionFormBlockQuestion, questionIndex: number, optionLabel: string) => void;
  onToggleOther?: (question: QuestionFormBlockQuestion, questionIndex: number) => void;
  onCustomAnswerChange?: (question: QuestionFormBlockQuestion, questionIndex: number, answer: string) => void;
}

const QuestionOptionContent = (props: { option: QuestionFormBlockQuestion["options"][number] }) => {
  const { option } = props;

  return (
    <Stack gap="0" minWidth="0">
      <Text textStyle="label/S/regular" color="fg">
        {option.label}
      </Text>
      {option.description ? (
        <Text textStyle="label/XS/regular" color="fg.muted">
          {option.description}
        </Text>
      ) : null}
    </Stack>
  );
};

const QuestionCheckboxOptionRow = (props: {
  option: QuestionFormBlockQuestion["options"][number];
  name: string;
  checked: boolean;
  editable: boolean;
  onToggle: () => void;
}) => {
  const { option, name, checked, editable, onToggle } = props;

  return (
    <Checkbox
      name={name}
      checked={checked}
      readOnly={!editable}
      aria-readonly={editable ? undefined : "true"}
      inputProps={editable ? undefined : { tabIndex: -1 }}
      alignItems="flex-start"
      onCheckedChange={editable ? onToggle : undefined}
    >
      <QuestionOptionContent option={option} />
    </Checkbox>
  );
};

const QuestionRadioOptions = (props: {
  question: QuestionFormBlockQuestion;
  questionIndex: number;
  name: string;
  selectedOption?: string;
  otherSelected: boolean;
  editable: boolean;
  onToggleOption?: (question: QuestionFormBlockQuestion, questionIndex: number, optionLabel: string) => void;
  onToggleOther?: (question: QuestionFormBlockQuestion, questionIndex: number) => void;
  otherField?: ReactNode;
}) => {
  const { question, questionIndex, name, selectedOption, otherSelected, editable, onToggleOption, onToggleOther } =
    props;
  const { otherField } = props;
  const hasOtherChoice = questionOffersOtherChoice(question);
  const selectedIndex = question.options.findIndex((option) => option.label === selectedOption);
  const selectedValue = selectedIndex === -1 ? null : String(selectedIndex);

  return (
    <RadioGroup
      name={name}
      value={otherSelected ? OTHER_CHOICE_VALUE : selectedValue}
      readOnly={!editable}
      aria-readonly={editable ? undefined : "true"}
      display="flex"
      flexDirection="column"
      gap="xs"
      onValueChange={
        editable
          ? (details) => {
              if (!details.value) return;
              if (details.value === OTHER_CHOICE_VALUE) onToggleOther?.(question, questionIndex);
              else onToggleOption?.(question, questionIndex, question.options[Number(details.value)].label);
            }
          : undefined
      }
    >
      {question.options.map((option, optionIndex) => (
        <Radio
          key={option.label}
          value={String(optionIndex)}
          inputProps={editable ? undefined : { tabIndex: -1 }}
          alignItems="flex-start"
        >
          <QuestionOptionContent option={option} />
        </Radio>
      ))}
      {hasOtherChoice ? (
        <Radio value={OTHER_CHOICE_VALUE} inputProps={editable ? undefined : { tabIndex: -1 }} alignItems="flex-start">
          <QuestionOptionContent option={{ label: OTHER_CHOICE_LABEL }} />
        </Radio>
      ) : null}
      {otherSelected ? otherField : null}
    </RadioGroup>
  );
};

export const TodoListBlockView = (props: { items: TodoListBlockItem[] }) => {
  const { items } = props;

  return (
    <Stack as="ul" gap="0" listStyleType="none" margin="0" padding="0">
      {items.map((item, index) => (
        <Box as="li" key={`${item.label}-${index}`}>
          <Checkbox checked={item.checked} readOnly aria-readonly="true" inputProps={{ tabIndex: -1 }} size="xs">
            <Text textStyle="label/XS/regular" color="fg">
              {item.label}
            </Text>
          </Checkbox>
        </Box>
      ))}
    </Stack>
  );
};

interface QuestionFieldsetProps {
  question: QuestionFormBlockQuestion;
  questionIndex: number;
  editable: boolean;
  selectedOptions: string[];
  customAnswer: string | undefined;
  onToggleOption?: (question: QuestionFormBlockQuestion, questionIndex: number, optionLabel: string) => void;
  onToggleOther?: (question: QuestionFormBlockQuestion, questionIndex: number) => void;
  onCustomAnswerChange?: (question: QuestionFormBlockQuestion, questionIndex: number, answer: string) => void;
}

const QuestionOtherField = (props: QuestionFieldsetProps & { hasOtherChoice: boolean }) => {
  const { question, questionIndex, editable, customAnswer, onCustomAnswerChange, hasOtherChoice } = props;

  return (
    <Textarea
      readOnly={!editable}
      aria-readonly={editable ? undefined : "true"}
      value={customAnswer ?? ""}
      placeholder={editable ? (hasOtherChoice ? "Type your answer..." : "Answer...") : "Answer"}
      aria-label={hasOtherChoice ? `${question.question} (${OTHER_CHOICE_LABEL})` : question.question}
      rows={2}
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="sm"
      padding="xs"
      resize={editable ? "vertical" : "none"}
      color="fg"
      onChange={(event) => onCustomAnswerChange?.(question, questionIndex, event.currentTarget.value)}
    />
  );
};

const QuestionCheckboxOptions = (props: QuestionFieldsetProps & { name: string; otherField: ReactNode }) => {
  const { question, questionIndex, editable, selectedOptions, customAnswer, onToggleOption, onToggleOther } = props;
  const { name, otherField } = props;
  const hasOtherChoice = questionOffersOtherChoice(question);
  const otherSelected = customAnswer !== undefined;

  return (
    <>
      {question.options.map((option) => (
        <QuestionCheckboxOptionRow
          key={option.label}
          option={option}
          name={name}
          checked={selectedOptions.includes(option.label)}
          editable={editable}
          onToggle={() => onToggleOption?.(question, questionIndex, option.label)}
        />
      ))}
      {hasOtherChoice ? (
        <QuestionCheckboxOptionRow
          option={{ label: OTHER_CHOICE_LABEL }}
          name={name}
          checked={otherSelected}
          editable={editable}
          onToggle={() => onToggleOther?.(question, questionIndex)}
        />
      ) : null}
      {otherSelected ? otherField : null}
    </>
  );
};

const QuestionFieldset = (props: QuestionFieldsetProps) => {
  const { question, questionIndex, editable, selectedOptions, customAnswer, onToggleOption, onToggleOther } = props;
  const name = question.id ?? `question-${questionIndex}`;
  const hasOtherChoice = questionOffersOtherChoice(question);
  const otherField = question.allowCustomAnswer ? (
    <QuestionOtherField {...props} hasOtherChoice={hasOtherChoice} />
  ) : null;
  const hasChoices = question.options.length > 0 || hasOtherChoice;

  return (
    <Stack
      as="fieldset"
      gap="xs"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="sm"
      padding="sm"
      minWidth="0"
    >
      <Text as="legend" textStyle="label/S/medium" color="fg" paddingX="2xs">
        {question.question}
      </Text>
      {hasChoices && question.multiple ? (
        <QuestionCheckboxOptions {...props} name={name} otherField={otherField} />
      ) : null}
      {hasChoices && !question.multiple ? (
        <QuestionRadioOptions
          question={question}
          questionIndex={questionIndex}
          name={name}
          selectedOption={selectedOptions[0]}
          otherSelected={customAnswer !== undefined}
          editable={editable}
          onToggleOption={onToggleOption}
          onToggleOther={onToggleOther}
          otherField={otherField}
        />
      ) : null}
      {/* Free text with nothing to choose between is not part of a choice group. */}
      {hasChoices ? null : otherField}
    </Stack>
  );
};

export const QuestionFormBlockView = (props: QuestionFormBlockViewProps) => {
  const {
    questions,
    editable = false,
    selectedOptionsByQuestion = {},
    customAnswersByQuestion = {},
    onToggleOption,
    onToggleOther,
    onCustomAnswerChange,
  } = props;

  return (
    <Stack as="form" gap="sm" onSubmit={preventSubmit} aria-label="Question form">
      {questions.map((question, questionIndex) => {
        const name = question.id ?? `question-${questionIndex}`;

        return (
          <QuestionFieldset
            key={name}
            question={question}
            questionIndex={questionIndex}
            editable={editable}
            selectedOptions={getOwnQuestionValue(selectedOptionsByQuestion, name) ?? []}
            customAnswer={getOwnQuestionValue(customAnswersByQuestion, name)}
            onToggleOption={onToggleOption}
            onToggleOther={onToggleOther}
            onCustomAnswerChange={onCustomAnswerChange}
          />
        );
      })}
    </Stack>
  );
};
