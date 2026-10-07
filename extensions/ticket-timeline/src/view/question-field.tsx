// Render accessible decision fields with the shared Chakra form primitives.
import { chakra, NativeSelect, Stack, Textarea } from "@chakra-ui/react";
import type { Question } from "../model/action-types";

export function QuestionField({
  question,
  prefix,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  prefix: string;
  value: string | string[] | undefined;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const id = `${prefix}-${question.id}`;
  const label = `${question.label}${question.required ? " *" : ""}`;
  if (question.kind === "multiple-choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <chakra.fieldset disabled={disabled}>
        <chakra.legend>{label}</chakra.legend>
        <Stack gap="xs" mt="xs">
          {question.options?.map((option) => (
            <chakra.label key={option.id} display="flex" gap="sm" alignItems="center">
              <chakra.input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={({ target }) =>
                  onChange(target.checked ? [...selected, option.id] : selected.filter((key) => key !== option.id))
                }
              />
              {option.label}
            </chakra.label>
          ))}
        </Stack>
      </chakra.fieldset>
    );
  }

  return (
    <Stack gap="xs">
      <chakra.label htmlFor={id}>{label}</chakra.label>
      {question.kind === "text" ? (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={({ target }) => onChange(target.value)}
          aria-required={question.required}
        />
      ) : (
        <NativeSelect.Root disabled={disabled} size="sm">
          <NativeSelect.Field
            id={id}
            aria-required={question.required}
            value={typeof value === "string" ? value : ""}
            onChange={({ target }) => onChange(target.value)}
          >
            <option value="">Choose an answer</option>
            {question.options?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      )}
    </Stack>
  );
}
