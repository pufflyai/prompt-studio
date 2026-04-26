import type { ToolPart } from "../agent-types";
import type {
  Block,
  Item,
  QuestionFormBlockOption,
  QuestionFormBlockQuestion,
  TitleSegment,
} from "../components/timeline";
import type { ToolRenderer } from "./types";

type QuestionRendererDependencies = {
  buildBaseTitle: (invocation: ToolPart, detail?: string, labelOverride?: string) => TitleSegment[];
  buildIndicator: (invocation: ToolPart) => Item["indicator"];
  prependErrorBlock: (invocation: ToolPart, blocks: Block[]) => Block[];
};

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

  if (typeof input === "string" && input.trim().length > 0) {
    return parseJsonObjectText(input);
  }

  return null;
};

const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

const getResponseText = (value: unknown): string | null => {
  const stringValue = getStringValue(value);
  if (stringValue) return stringValue;

  if (Array.isArray(value)) {
    const lines = value.map(getResponseText).filter((line): line is string => line !== null);
    return lines.length > 0 ? lines.join("\n") : null;
  }

  if (!isRecord(value)) return null;

  return (
    getResponseText(value.response) ??
    getResponseText(value.answer) ??
    getResponseText(value.text) ??
    getResponseText(value.answers)
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
        : type === "freeform" || type === "text";

  if (options.length === 0 && !allowCustomAnswer) return null;

  return {
    id: getStringValue(value.id) ?? `question-${index}`,
    question,
    options,
    multiple:
      typeof value.multiple === "boolean" ? value.multiple : type === "multi_choice" || type === "multiple_choice",
    required: typeof value.required === "boolean" ? value.required : false,
    allowCustomAnswer,
  };
};

const parseQuestionBlock = (input: unknown) => {
  const record = toInputRecord(input);
  if (!record || !Array.isArray(record.questions)) return null;

  const questions = record.questions.map(parseQuestion).filter((question): question is QuestionFormBlockQuestion => {
    return question !== null;
  });
  if (questions.length === 0) return null;

  return {
    type: "question-form",
    questions,
  } satisfies Block;
};

export const createQuestionRenderer = (deps: QuestionRendererDependencies): ToolRenderer => {
  const { buildBaseTitle, buildIndicator, prependErrorBlock } = deps;

  return (invocation) => {
    const responseText = getResponseText(invocation.state?.output) ?? getResponseText(invocation.state?.metadata);
    const block = parseQuestionBlock(invocation.state?.input);
    if (!responseText && !block) return null;

    const fieldLabel = block ? `${block.questions.length} field${block.questions.length === 1 ? "" : "s"}` : undefined;
    const blocks = responseText ? [] : [block!];

    return {
      indicator: buildIndicator(invocation),
      title: buildBaseTitle(invocation, fieldLabel, "Question"),
      blocks: prependErrorBlock(invocation, blocks),
      expandable: false,
    } satisfies Item;
  };
};
