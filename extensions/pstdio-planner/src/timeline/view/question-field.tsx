import { SelectionInput } from "@pstdio/ui/param-editor";
import type { Question } from "../model/action-types";

interface QuestionFieldProps {
  question: Question;
  prefix: string;
  value: string | string[] | undefined;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}
export function QuestionField(props: QuestionFieldProps) {
  const { question, prefix, value, disabled, onChange } = props;
  if (question.kind === "text") {
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
      options={question.options?.map(({ id, label }) => ({ id, name: label, icon: "circle" })) ?? []}
      multiSelect={question.kind === "multiple-choice"}
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
