import type { SessionMessage, ToolPart } from "../components/message-types";
import type { QuestionFormBlockOption, QuestionFormBlockQuestion } from "../components/timeline";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseJsonObjectText = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const toInputRecord = (input: unknown) => {
  if (isRecord(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) return parseJsonObjectText(input);
  return null;
};

const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

export const getQuestionResponseText = (value: unknown): string | null => {
  const stringValue = getStringValue(value);
  if (stringValue) return stringValue;

  if (Array.isArray(value)) {
    const lines = value.map(getQuestionResponseText).filter((line): line is string => line !== null);
    return lines.length > 0 ? lines.join("\n") : null;
  }

  if (!isRecord(value)) return null;

  return (
    getQuestionResponseText(value.response) ??
    getQuestionResponseText(value.answer) ??
    getQuestionResponseText(value.text) ??
    getQuestionResponseText(value.answers)
  );
};

const parseQuestionOption = (value: unknown): QuestionFormBlockOption | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return { label: value, description: undefined };
  }

  if (!isRecord(value)) return null;
  const label = getStringValue(value.label);
  if (!label) return null;

  return {
    label,
    description: getStringValue(value.description) ?? undefined,
  };
};

const parseQuestion = (value: unknown, index: number): QuestionFormBlockQuestion | null => {
  if (!isRecord(value)) return null;

  const question = getStringValue(value.question);
  if (!question) return null;

  const options = Array.isArray(value.options)
    ? value.options.map(parseQuestionOption).filter((option): option is QuestionFormBlockOption => option !== null)
    : [];
  const type = getStringValue(value.type);
  const allowCustomAnswer =
    typeof value.custom === "boolean"
      ? value.custom
      : typeof value.allowCustomAnswer === "boolean"
        ? value.allowCustomAnswer
        : options.length === 0 || type === "freeform" || type === "text";

  return {
    id: getStringValue(value.id) ?? `question-${index}`,
    question,
    options,
    multiple:
      typeof value.multiple === "boolean" ? value.multiple : type === "multi_choice" || type === "multiple_choice",
    required: typeof value.required === "boolean" ? value.required : true,
    allowCustomAnswer,
  };
};

export const parseQuestionPrompt = (input: unknown) => {
  const record = toInputRecord(input);
  if (!record || !Array.isArray(record.questions)) return null;

  const questions = record.questions.map(parseQuestion).filter((question): question is QuestionFormBlockQuestion => {
    return question !== null;
  });
  if (questions.length === 0) return null;

  return { questions };
};

const isQuestionTool = (part: ToolPart) => part.tool.toLowerCase() === "question";

export const resolveActiveQuestionPrompt = (messages: SessionMessage[]) => {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant") continue;

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (part.type !== "tool" || !isQuestionTool(part)) continue;

      const response = getQuestionResponseText(part.state?.output) ?? getQuestionResponseText(part.state?.metadata);
      if (response) return undefined;

      return parseQuestionPrompt(part.state?.input) ?? undefined;
    }
  }

  return undefined;
};
