import { SelectionInput } from "@pstdio/ui/param-editor";
import type { ReviewQuestion } from "../../data/review-request-types";

interface QuestionFieldProps {
  question: ReviewQuestion;
  prefix: string;
  value: string | string[] | undefined;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}
export function QuestionField(props: QuestionFieldProps) {
  const { question, prefix, value, disabled, onChange } = props;
  if (question.input.kind === "text") {
    return <TextAnswer {...props} />;
  }
  return (
    <SelectionInput
      id={`${prefix}-${question.id}`}
      name={question.label + (question.required ? " *" : "")}
      description=""
      disabled={disabled}
      defaultValue={value ?? ""}
      placeholder="Choose an answer"
      options={question.input.options.map(({ id, label }) => ({ id, name: label, icon: "circle" }))}
      multiSelect={question.input.kind === "multiple-choice"}
      onChange={(_id, next) => onChange(next)}
    />
  );
}

import { chakra, Stack, Textarea } from "@chakra-ui/react";

function TextAnswer(props: QuestionFieldProps) {
  const { question, prefix, value, disabled, onChange } = props;
  const id = `${prefix}-${question.id}`;
  return (
    <Stack gap="xs">
      <chakra.label htmlFor={id}>
        {question.label}
        {question.required ? " *" : ""}
      </chakra.label>
      <Textarea
        id={id}
        size="sm"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={({ target }) => onChange(target.value)}
        aria-required={question.required}
      />
    </Stack>
  );
}
