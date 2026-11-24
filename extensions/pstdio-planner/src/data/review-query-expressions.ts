import type { StorageExpression as Expression } from "@pstdio/sdk/extensions";

export const literal = (literal: string | number | boolean | null): Expression => ({ literal });
export const get = (get: Expression, key: string | Expression): Expression => ({ get, key });
export const operation = (op: Extract<Expression, { op: string }>["op"], ...args: Expression[]): Expression => ({
  op,
  args,
});
const variable = (variable: string): Expression => ({ variable });
const each = (source: Expression, as: string, mode: "every" | "some" | "map", where: Expression): Expression => ({
  each: source,
  as,
  mode,
  where,
});
const eq = (a: Expression, b: string | number | boolean | null) => operation("eq", a, literal(b));
const any = (...args: Expression[]) => operation("or", ...args);
const all = (...args: Expression[]) => operation("and", ...args);
const nullable = (value: Expression) => any(eq(value, null), operation("nonblank", value));
const actor = (value: Expression) =>
  all(
    operation("isObject", value),
    any(...["human", "agent", "automation"].map((type) => eq(get(value, "type"), type))),
    operation("nonblank", get(value, "id")),
    operation("nonblank", get(value, "displayName")),
  );
const uniqueIds = (source: Expression, name: string) =>
  all(
    operation("isArray", source),
    operation("not", eq(operation("length", source), 0)),
    operation("unique", each(source, name, "map", get(variable(name), "id"))),
  );

const root = variable("value");
const body = get(root, "request");
const questions = get(body, "questions");
const question = variable("question");
const input = get(question, "input");
const options = get(input, "options");
const context = get(root, "context");

/** Same accepted stored shapes as parseStoredRequest, including nullable context and arbitrary nonblank reason. */
export const validStoredRequestExpression = all(
  operation("isObject", root),
  ...["id", "ticketId", "title", "instructions", "requestedAt"].map((key) => operation("nonblank", get(root, key))),
  actor(get(root, "requestedBy")),
  operation("isObject", context),
  any(operation("missing", get(context, "attemptId")), operation("nonblank", get(context, "attemptId"))),
  ...["reason", "workspaceId", "sessionId", "relatedSessionId"].map((key) => nullable(get(context, key))),
  any(eq(get(context, "attemptRevision"), null), operation("isInteger", get(context, "attemptRevision"))),
  any(
    operation("missing", get(context, "affectedAction")),
    eq(get(context, "affectedAction"), "implementation"),
    eq(get(context, "affectedAction"), "merge"),
  ),
  operation("isObject", body),
  any(
    eq(get(body, "kind"), "task"),
    all(
      eq(get(body, "kind"), "decision"),
      uniqueIds(questions, "questionId"),
      each(
        questions,
        "question",
        "every",
        all(
          operation("isObject", question),
          operation("nonblank", get(question, "id")),
          operation("nonblank", get(question, "label")),
          operation("isBoolean", get(question, "required")),
          operation("isObject", input),
          any(
            eq(get(input, "kind"), "text"),
            all(
              any(eq(get(input, "kind"), "single-choice"), eq(get(input, "kind"), "multiple-choice")),
              uniqueIds(options, "optionId"),
              each(
                options,
                "option",
                "every",
                all(
                  operation("isObject", variable("option")),
                  operation("nonblank", get(variable("option"), "id")),
                  operation("nonblank", get(variable("option"), "label")),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);

export const validOutcomeHeaderExpression = all(
  operation("isObject", root),
  operation("nonblank", get(root, "at")),
  actor(get(root, "by")),
  any(
    all(eq(get(root, "kind"), "cancelled"), operation("nonblank", get(root, "reason"))),
    all(eq(get(root, "kind"), "answered"), operation("isObject", get(root, "response"))),
  ),
);

// Evaluated with the outcome as the current index and its canonical request as parent.
const requestBody: Expression = { field: "body", up: 1 };
const response: Expression = { field: "response" };
const requestedQuestions = get(requestBody, "questions");
const answers = get(response, "answers");
const requestedQuestion = variable("requestedQuestion");
const answer = get(answers, get(requestedQuestion, "id"));
const answerInput = get(requestedQuestion, "input");
const allowed = get(answerInput, "options");
const validChoice = (choice: Expression) =>
  all(
    operation("isString", choice),
    each(allowed, "allowedOption", "some", operation("eq", get(variable("allowedOption"), "id"), choice)),
  );
const emptyAnswer = any(
  operation("missing", answer),
  all(operation("isString", answer), operation("not", operation("nonblank", answer))),
  all(operation("isArray", answer), eq(operation("length", answer), 0)),
);

const choiceAnswer = operation(
  "if",
  eq(get(answerInput, "kind"), "single-choice"),
  validChoice(answer),
  all(
    operation("isArray", answer),
    operation("unique", answer),
    each(answer, "chosenOption", "every", validChoice(variable("chosenOption"))),
  ),
);
const requiredAnswer = operation(
  "if",
  eq(get(answerInput, "kind"), "text"),
  operation("isString", answer),
  choiceAnswer,
);
const questionAnswer = operation("if", emptyAnswer, eq(get(requestedQuestion, "required"), false), requiredAnswer);
export const validResponseExpression = operation(
  "if",
  eq(get(requestBody, "kind"), "task"),
  eq(get(response, "confirmed"), true),
  all(
    operation("isObject", answers),
    each(
      operation("keys", answers),
      "answerKey",
      "every",
      any(
        eq(variable("answerKey"), ""),
        each(
          requestedQuestions,
          "knownQuestion",
          "some",
          operation("eq", get(variable("knownQuestion"), "id"), variable("answerKey")),
        ),
      ),
    ),
    each(requestedQuestions, "requestedQuestion", "every", questionAnswer),
  ),
);
