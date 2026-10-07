// Validate ticket action documents and responses before saving or rendering them.
import type { ActionResponse, HumanAction, Question } from "./action-types";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an action object.");
  }

  return value as Record<string, unknown>;
}

function text(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function question(value: unknown): Question {
  const input = record(value);
  const id = text(input.id, "Question id");
  const label = text(input.label, "Question label");
  if (
    !["single-choice", "multiple-choice", "text"].includes(String(input.kind)) ||
    typeof input.required !== "boolean"
  ) {
    throw new Error("Invalid question type or required setting.");
  }

  const options = Array.isArray(input.options)
    ? input.options.map((entry) => {
        const option = record(entry);
        return { id: text(option.id, "Choice id"), label: text(option.label, "Choice label") };
      })
    : undefined;
  if (
    input.kind !== "text" &&
    (!options?.length || new Set(options.map(({ id: key }) => key)).size !== options.length)
  ) {
    throw new Error("Choices must be present and unique.");
  }

  return { id, label, kind: input.kind as Question["kind"], required: input.required, ...(options ? { options } : {}) };
}

export function parseAction(content: string): HumanAction {
  const input = record(JSON.parse(content));
  if (input.version !== 1 || !Number.isInteger(input.revision) || Number(input.revision) < 1) {
    throw new Error("Invalid action version or revision.");
  }

  const request = record(input.request);
  let typed: HumanAction["request"];
  if (request.kind === "task") {
    typed = { kind: "task" };
  } else if (request.kind === "decision" && Array.isArray(request.questions)) {
    const questions = request.questions.map(question);
    if (!questions.length || new Set(questions.map(({ id }) => id)).size !== questions.length) {
      throw new Error("Questions must be present and unique.");
    }

    typed = { kind: "decision", questions };
  } else {
    throw new Error("Invalid action request.");
  }

  const action: HumanAction = {
    version: 1,
    id: text(input.id, "Action id"),
    revision: Number(input.revision),
    title: text(input.title, "Action title"),
    instructions: text(input.instructions, "Instructions"),
    request: typed,
  };
  if (input.resolution !== undefined) {
    const resolution = record(input.resolution);
    action.resolution = {
      at: text(resolution.at, "Resolution time"),
      response: validateResponse(action, resolution.response),
    };
  }

  if (input.cancellation !== undefined) {
    if (action.resolution) {
      throw new Error("An action cannot be resolved and cancelled.");
    }
    const cancelled = record(input.cancellation);
    action.cancellation = {
      at: text(cancelled.at, "Cancellation time"),
      reason: text(cancelled.reason, "Cancellation reason"),
    };
  }
  return action;
}

function answerFor(question: Question, answer: unknown) {
  if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
    if (question.required) {
      throw new Error(`${question.label} is required.`);
    }
    return;
  }

  if (question.kind === "multiple-choice") {
    if (
      !Array.isArray(answer) ||
      !answer.every((entry) => typeof entry === "string") ||
      new Set(answer).size !== answer.length
    ) {
      throw new Error(`Invalid choices for ${question.label}.`);
    }
  } else if (typeof answer !== "string" || !answer.trim()) {
    throw new Error(`Invalid answer for ${question.label}.`);
  }

  if (question.kind !== "text") {
    const allowed = new Set(question.options?.map(({ id }) => id));
    if (!(Array.isArray(answer) ? answer : [answer]).every((entry) => allowed.has(String(entry)))) {
      throw new Error(`Invalid choice for ${question.label}.`);
    }
  }
}

export function validateResponse(action: HumanAction, value: unknown): ActionResponse {
  const input = record(value);
  if (action.request.kind === "task") {
    if (input.confirmed !== true) {
      throw new Error("Explicit completion confirmation is required.");
    }
    return { confirmed: true };
  }

  const answers = record(input.answers);
  const questions = action.request.questions;
  if (Object.keys(answers).some((id) => !questions.some((entry) => entry.id === id))) {
    throw new Error("Unknown question in answer.");
  }

  for (const entry of questions) {
    answerFor(entry, answers[entry.id]);
  }
  return { answers: answers as Record<string, string | string[]> };
}

export function resolveAction(action: HumanAction, revision: number, response: unknown): HumanAction {
  if (action.revision !== revision) {
    throw new Error("The request changed. Reload it before answering.");
  }
  if (action.resolution || action.cancellation) {
    throw new Error("This action is already resolved or cancelled.");
  }
  return { ...action, resolution: { at: new Date().toISOString(), response: validateResponse(action, response) } };
}
