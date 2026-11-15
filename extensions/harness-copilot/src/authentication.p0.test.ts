import { expect, test } from "bun:test";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { CLI_LOGIN, readAuthentication, runLogin } from "./authentication";
import { fakeCopilot } from "./copilot.fixture";

const channel = (reply: string) => {
  const emitted: unknown[] = [];
  const requested: unknown[] = [];
  return {
    emitted,
    requested,
    channel: {
      signal: new AbortController().signal,
      emit: async (prompt) => void emitted.push(prompt),
      request: async (prompt) => {
        requested.push(prompt);
        return reply;
      },
    } satisfies HarnessAuthenticationChannel,
  };
};

test("a pasted GitHub token goes to Copilot's credential store through a masked prompt", async () => {
  const copilot = fakeCopilot(() => []);
  const stored: string[] = [];
  let signedIn = false;
  copilot.client.storeToken = async (token) => {
    stored.push(token);
    signedIn = true;
  };
  copilot.client.getAuthStatus = async () => ({ isAuthenticated: signedIn });
  const login = channel("  ghp_secret \n");
  await runLogin(copilot.client, { action: "login", method: "token" }, login.channel);
  expect(stored).toEqual(["ghp_secret"]);
  expect(login.requested).toEqual([expect.objectContaining({ type: "input", secret: true })]);
  expect(JSON.stringify(login.emitted)).not.toContain("ghp_secret");
  expect(await readAuthentication(copilot.client)).toMatchObject({ status: "signed_in", provider: "github" });
});

test("a token Copilot rejects fails the sign-in, and the GitHub CLI method explains what to run", async () => {
  const copilot = fakeCopilot(() => []);
  copilot.client.getAuthStatus = async () => ({ isAuthenticated: false });
  await expect(runLogin(copilot.client, { action: "login", method: "token" }, channel("bad").channel)).rejects.toThrow(
    "did not accept",
  );
  const cli = channel("");
  const saved = { ...CLI_LOGIN };
  Object.assign(CLI_LOGIN, { intervalMs: 1, timeoutMs: 20 });
  try {
    await expect(runLogin(copilot.client, { action: "login", method: "gh-cli" }, cli.channel)).rejects.toThrow(
      "did not see",
    );
  } finally {
    Object.assign(CLI_LOGIN, saved);
  }
  expect(cli.emitted).toEqual([
    expect.objectContaining({ type: "message", message: expect.stringContaining("gh auth login") }),
  ]);
  await expect(runLogin(copilot.client, { action: "logout" }, cli.channel)).rejects.toThrow("gh auth logout");
});

test("signing in without a chosen method asks for one, and the GitHub CLI method waits for the login", async () => {
  const copilot = fakeCopilot(() => []);
  let checks = 0;
  copilot.client.getAuthStatus = async () => ({ isAuthenticated: ++checks >= 3 });
  const login = channel("gh-cli");
  const saved = { ...CLI_LOGIN };
  Object.assign(CLI_LOGIN, { intervalMs: 1 });
  try {
    await runLogin(copilot.client, { action: "login" }, login.channel);
  } finally {
    Object.assign(CLI_LOGIN, saved);
  }
  expect(login.requested).toEqual([
    expect.objectContaining({
      type: "select",
      options: [expect.objectContaining({ id: "gh-cli" }), expect.objectContaining({ id: "token" })],
    }),
  ]);
  expect(checks).toBe(3);
});
