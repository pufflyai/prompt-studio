import { expect, test } from "bun:test";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { authenticatePiAccount, getPiAccountState } from "./account-state";

test("Pi stores and removes keys through its native store and scopes readiness to the model provider", async () => {
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const accounts = { authStorage, modelRegistry };
  const channel = { signal: new AbortController().signal, emit: async () => {}, request: async () => "fixture-key" };
  await authenticatePiAccount(accounts, { action: "login", provider: "anthropic", method: "api_key" }, channel);
  expect(authStorage.get("anthropic")).toEqual({ type: "api_key", key: "fixture-key" });
  expect(getPiAccountState(accounts, "anthropic/claude-sonnet-4-6").status).toBe("signed_in");
  expect(getPiAccountState(accounts, "openai/gpt-5").status).toBe("signed_out");
  await authenticatePiAccount(accounts, { action: "logout", provider: "anthropic" }, channel);
  expect(authStorage.has("anthropic")).toBe(false);
  await authenticatePiAccount(accounts, { action: "logout" }, channel);
});

test("Pi discovers OAuth providers registered by its native extensions and relays their callback choices", async () => {
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const accounts = { authStorage, modelRegistry };
  const credentials = { access: "fixture-access", refresh: "fixture-refresh", expires: Date.now() + 60_000 };
  modelRegistry.registerProvider("fixture-oauth", {
    oauth: {
      name: "Fixture OAuth",
      login: async (callbacks) => {
        callbacks.onAuth({ url: "https://example.test/sign-in" });
        expect(await callbacks.onSelect?.({ message: "Organization", options: [{ id: "team", label: "Team" }] })).toBe(
          "team",
        );
        expect(await callbacks.onPrompt({ message: "Authorization code" })).toBe("fixture-code");
        return credentials;
      },
      refreshToken: async () => credentials,
      getApiKey: () => "fixture-access",
    },
  });
  const prompts: unknown[] = [];
  try {
    await authenticatePiAccount(
      accounts,
      { action: "login", provider: "fixture-oauth", method: "oauth" },
      {
        signal: new AbortController().signal,
        emit: async (prompt) => {
          prompts.push(prompt);
        },
        request: async (question) => (question.type === "select" ? "team" : "fixture-code"),
      },
    );
    expect(prompts).toContainEqual({ type: "browser", url: "https://example.test/sign-in", message: undefined });
    expect(authStorage.get("fixture-oauth")).toMatchObject({ type: "oauth", access: "fixture-access" });
  } finally {
    modelRegistry.unregisterProvider("fixture-oauth");
  }
});
