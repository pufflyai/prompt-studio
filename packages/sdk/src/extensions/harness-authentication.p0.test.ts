import { expect, test } from "bun:test";
import { chooseHarnessAuthentication } from "./harness-authentication";

test("account choices use the selected model provider and never log out an environment credential", async () => {
  const questions: unknown[] = [];
  const authentication = {
    status: "signed_out" as const,
    provider: "anthropic",
    providers: [
      {
        id: "openai",
        label: "OpenAI",
        status: "signed_in" as const,
        canLogout: false,
        methods: [{ id: "key", label: "API key", kind: "api_key" as const }],
      },
      {
        id: "anthropic",
        label: "Anthropic",
        status: "signed_out" as const,
        canLogout: true,
        methods: [
          { id: "oauth", label: "Subscription", kind: "oauth" as const },
          { id: "key", label: "API key", kind: "api_key" as const },
        ],
      },
    ],
  };
  const channel = {
    signal: new AbortController().signal,
    emit: async () => {},
    request: async (prompt: unknown) => {
      questions.push(prompt);
      return questions.length === 1 ? "anthropic" : "key";
    },
  };
  expect(await chooseHarnessAuthentication(authentication, { action: "login" }, channel)).toMatchObject({
    provider: "anthropic",
    method: "key",
  });
  expect(questions[0]).toMatchObject({ initial: "anthropic" });
  expect(await chooseHarnessAuthentication(authentication, { action: "logout" }, channel)).toEqual({
    provider: "anthropic",
  });
  expect(questions).toHaveLength(2);
});

test("signing out with no stored account is an idempotent action", async () => {
  expect(
    await chooseHarnessAuthentication(
      {
        status: "signed_out",
        providers: [{ id: "native", label: "Native", status: "signed_out", canLogout: false, methods: [] }],
      },
      { action: "logout" },
      {
        signal: new AbortController().signal,
        emit: async () => {},
        request: async () => {
          throw Error("No question is needed");
        },
      },
    ),
  ).toBeNull();
});
