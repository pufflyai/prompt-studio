import { Box, Stack, Text, Textarea } from "@chakra-ui/react";
import type { FormEvent } from "react";
import { Checkbox } from "@/components/primitives/checkbox";
import { Radio, RadioGroup } from "@/components/primitives/radio";
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
  editable: boolean;
  onToggleOption?: (question: QuestionFormBlockQuestion, questionIndex: number, optionLabel: string) => void;
}) => {
  const { question, questionIndex, name, selectedOption, editable, onToggleOption } = props;

  return (
    <RadioGroup
      name={name}
      value={selectedOption ?? null}
      readOnly={!editable}
      aria-readonly={editable ? undefined : "true"}
      display="flex"
      flexDirection="column"
      gap="xs"
      onValueChange={
        editable
          ? (details) => {
              if (details.value) onToggleOption?.(question, questionIndex, details.value);
            }
          : undefined
      }
    >
      {question.options.map((option) => (
        <Radio
          key={option.label}
          value={option.label}
          inputProps={editable ? undefined : { tabIndex: -1 }}
          alignItems="flex-start"
        >
          <QuestionOptionContent option={option} />
        </Radio>
      ))}
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

export const QuestionFormBlockView = (props: QuestionFormBlockViewProps) => {
  const {
    questions,
    editable = false,
    selectedOptionsByQuestion = {},
    customAnswersByQuestion = {},
    onToggleOption,
    onCustomAnswerChange,
  } = props;

  return (
    <Stack as="form" gap="sm" onSubmit={preventSubmit} aria-label="Question form">
      {questions.map((question, questionIndex) => {
        const name = question.id ?? `question-${questionIndex}`;
        const inputType = question.multiple ? "checkbox" : "radio";
        const selectedOptions = selectedOptionsByQuestion[name] ?? [];

        return (
          <Stack
            as="fieldset"
            key={name}
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
            {inputType === "radio" ? (
              <QuestionRadioOptions
                question={question}
                questionIndex={questionIndex}
                name={name}
                selectedOption={selectedOptions[0]}
                editable={editable}
                onToggleOption={onToggleOption}
              />
            ) : (
              question.options.map((option) => (
                <QuestionCheckboxOptionRow
                  key={option.label}
                  option={option}
                  name={name}
                  checked={selectedOptions.includes(option.label)}
                  editable={editable}
                  onToggle={() => onToggleOption?.(question, questionIndex, option.label)}
                />
              ))
            )}
            {question.allowCustomAnswer ? (
              <Textarea
                readOnly={!editable}
                aria-readonly={editable ? undefined : "true"}
                value={customAnswersByQuestion[name] ?? ""}
                placeholder={editable ? "Answer..." : "Custom answer"}
                aria-label={question.question}
                rows={2}
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="sm"
                padding="xs"
                resize={editable ? "vertical" : "none"}
                color="fg"
                onChange={(event) => onCustomAnswerChange?.(question, questionIndex, event.currentTarget.value)}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
};
