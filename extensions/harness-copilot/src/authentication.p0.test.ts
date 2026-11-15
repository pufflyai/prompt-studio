import { expect, test } from "bun:test";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { readAuthentication, runLogin } from "./authentication";
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
  await runLogin(copilot.client, { action: "login" }, cli.channel);
  expect(cli.emitted).toEqual([
    expect.objectContaining({ type: "message", message: expect.stringContaining("gh auth login") }),
  ]);
  await expect(runLogin(copilot.client, { action: "logout" }, cli.channel)).rejects.toThrow("gh auth logout");
});
