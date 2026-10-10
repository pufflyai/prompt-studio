// Validate review requests, responses, and stored records before any write or read model uses them.
import type { ActorRef } from "./attempt-types";
import type {
  ReviewOption,
  ReviewOutcome,
  ReviewQuestion,
  ReviewRequest,
  ReviewRequestBody,
  ReviewResponse,
} from "./review-request-types";

const record = (value: unknown, name: string) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
};

const text = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
};

const nullableText = (value: unknown, name: string) => (value === null ? null : text(value, name));

const uniqueIds = <T extends { id: string }>(items: T[], name: string) => {
  if (!items.length || new Set(items.map(({ id }) => id)).size !== items.length) {
    throw new Error(`${name} must be present and unique.`);
  }
  return items;
};

const option = (value: unknown): ReviewOption => {
  const input = record(value, "Choice");
  return { id: text(input.id, "Choice id"), label: text(input.label, "Choice label") };
};

const question = (value: unknown): ReviewQuestion => {
  const input = record(value, "Question");
  if (typeof input.required !== "boolean") throw new Error("Question required setting must be true or false.");
  const answerInput = record(input.input, "Question input");
  const base = {
    id: text(input.id, "Question id"),
    label: text(input.label, "Question label"),
    required: input.required,
  };
  if (answerInput.kind === "text") return { ...base, input: { kind: "text" } };
  if (
    (answerInput.kind === "single-choice" || answerInput.kind === "multiple-choice") &&
    Array.isArray(answerInput.options)
  ) {
    return {
      ...base,
      input: { kind: answerInput.kind, options: uniqueIds(answerInput.options.map(option), "Choices") },
    };
  }
  throw new Error(`Question ${base.id} has an invalid input kind.`);
};

export const parseRequestBody = (value: unknown): ReviewRequestBody => {
  const input = record(value, "Request");
  if (input.kind === "task") return { kind: "task" };
  if (input.kind === "decision" && Array.isArray(input.questions)) {
    return { kind: "decision", questions: uniqueIds(input.questions.map(question), "Questions") };
  }
  throw new Error('Request kind must be "task" or "decision" with questions.');
};

const checkAnswer = (entry: ReviewQuestion, answer: unknown) => {
  const empty = (typeof answer === "string" && !answer.trim()) || (Array.isArray(answer) && answer.length === 0);
  if (answer === undefined || empty) {
    if (entry.required) throw new Error(`${entry.label} is required.`);
    return;
  }
  if (entry.input.kind === "text") {
    if (typeof answer !== "string") throw new Error(`Invalid answer for ${entry.label}.`);
    return;
  }
  const values = entry.input.kind === "multiple-choice" ? answer : [answer];
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new Error(`Invalid choices for ${entry.label}.`);
  }
  if (new Set(values).size !== values.length) throw new Error(`Duplicate choices for ${entry.label}.`);
  const allowed = new Set(entry.input.options.map(({ id }) => id));
  if (!values.every((value) => allowed.has(value))) throw new Error(`Invalid choice for ${entry.label}.`);
};

export const validateResponse = (body: ReviewRequestBody, value: unknown): ReviewResponse => {
  const input = record(value, "Response");
  if (body.kind === "task") {
    if (input.confirmed !== true) throw new Error('A task response must be {"confirmed":true}.');
    return { confirmed: true };
  }
  const answers = record(input.answers, "Response answers");
  const unknown = Object.keys(answers).find((id) => !body.questions.some((entry) => entry.id === id));
  if (unknown) throw new Error(`Unknown question "${unknown}" in the response.`);
  for (const entry of body.questions) checkAnswer(entry, answers[entry.id]);
  return { answers: answers as Record<string, string | string[]> };
};

const actor = (value: unknown): ActorRef => {
  const input = record(value, "Actor");
  if (input.type !== "human" && input.type !== "agent" && input.type !== "automation") {
    throw new Error("Actor type is invalid.");
  }
  return { ...input, type: input.type, id: text(input.id, "Actor id"), displayName: text(input.displayName, "Actor") };
};

const revision = (value: unknown) => {
  if (value === null) return null;
  if (!Number.isInteger(value)) throw new Error("Attempt revision must be a whole number.");
  return value as number;
};

export const parseStoredRequest = (value: unknown): ReviewRequest => {
  const input = record(value, "Stored request");
  const context = record(input.context, "Request context");
  return {
    id: text(input.id, "Request id"),
    ticketId: text(input.ticketId, "Request ticket"),
    title: text(input.title, "Request title"),
    instructions: text(input.instructions, "Request instructions"),
    request: parseRequestBody(input.request),
    requestedAt: text(input.requestedAt, "Request time"),
    requestedBy: actor(input.requestedBy),
    context: {
      reason: nullableText(context.reason, "Request reason") as ReviewRequest["context"]["reason"],
      workspaceId: nullableText(context.workspaceId, "Request workspace"),
      attemptRevision: revision(context.attemptRevision),
      sessionId: text(context.sessionId, "Request session"),
      relatedSessionId: nullableText(context.relatedSessionId, "Related session"),
    },
  };
};

export const parseStoredOutcome = (request: ReviewRequest, value: unknown): ReviewOutcome => {
  const input = record(value, "Stored outcome");
  const base = { at: text(input.at, "Outcome time"), by: actor(input.by) };
  if (input.kind === "answered") {
    return { kind: "answered", ...base, response: validateResponse(request.request, input.response) };
  }
  if (input.kind === "cancelled") return { kind: "cancelled", ...base, reason: text(input.reason, "Cancel reason") };
  throw new Error("Outcome kind is invalid.");
};
