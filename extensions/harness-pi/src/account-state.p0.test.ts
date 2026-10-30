import { expect, test } from "bun:test";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { authenticatePiAccount, getPiAccountState } from "./account-state";

test("Pi stores and removes keys through its native store and scopes readiness to the model provider", async () => {
  delete process.env.COPILOT_GITHUB_TOKEN;
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const accounts = { authStorage, modelRegistry };
  const channel = {
    signal: new AbortController().signal,
    emit: async () => {},
    request: async () => "  fixture-key\n",
  };
  await authenticatePiAccount(accounts, { action: "login", provider: "anthropic", method: "api_key" }, channel);
  expect(authStorage.get("anthropic")).toEqual({ type: "api_key", key: "fixture-key" });
  expect(getPiAccountState(accounts, "anthropic/claude-sonnet-4-6").status).toBe("signed_in");
  expect(getPiAccountState(accounts, "openai/gpt-5").status).toBe("signed_out");
  await authenticatePiAccount(accounts, { action: "logout", provider: "anthropic" }, channel);
  expect(authStorage.has("anthropic")).toBe(false);
  await authenticatePiAccount(accounts, { action: "logout" }, channel);
});

test("Pi keeps externally managed Copilot credentials outside native logout", async () => {
  process.env.COPILOT_GITHUB_TOKEN = "fixture-ci-token";
  const authStorage = AuthStorage.inMemory();
  const accounts = { authStorage, modelRegistry: ModelRegistry.inMemory(authStorage) };
  const state = getPiAccountState(accounts, "github-copilot/gpt-5");
  expect(state.status).toBe("signed_in");
  expect(state.providers.find((provider) => provider.id === "github-copilot")?.canLogout).toBe(false);
  await expect(
    authenticatePiAccount(
      accounts,
      { action: "logout", provider: "github-copilot" },
      {
        signal: new AbortController().signal,
        emit: async () => {},
        request: async () => {
          throw new Error("Managed accounts must not prompt for native logout.");
        },
      },
    ),
  ).rejects.toThrow("managed outside");
  expect(process.env.COPILOT_GITHUB_TOKEN).toBe("fixture-ci-token");
  expect(authStorage.list()).toEqual([]);
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
        callbacks.onDeviceCode({ verificationUri: "https://example.test/device", userCode: "FIXTURE-CODE" });
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
    expect(prompts).toContainEqual({
      type: "browser",
      url: "https://example.test/device",
      message: expect.stringContaining("FIXTURE-CODE"),
    });
    expect(authStorage.get("fixture-oauth")).toMatchObject({ type: "oauth", access: "fixture-access" });
  } finally {
    modelRegistry.unregisterProvider("fixture-oauth");
  }
});
