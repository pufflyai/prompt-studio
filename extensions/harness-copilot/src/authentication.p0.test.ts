import { expect, test } from "bun:test";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { CLI_LOGIN, describeAuthentication, type LoginDeps, runLogin, tokenEnv } from "./authentication";
import { fakeCopilot, harnessContext } from "./copilot.fixture";
import { createCopilotHarness } from "./harness";

const channel = (...replies: string[]) => {
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
        return replies.shift() ?? "";
      },
    } satisfies HarnessAuthenticationChannel,
  };
};

const deps = (accepts: (token?: string) => boolean, saved?: string) => {
  const state = { saved, checks: [] as (string | undefined)[] };
  const value: LoginDeps = {
    signedIn: async (token) => {
      state.checks.push(token);
      return accepts(token);
    },
    savedToken: async () => state.saved,
    saveToken: async (token) => {
      state.saved = token;
    },
    clearToken: async () => {
      state.saved = undefined;
    },
  };
  return { value, state };
};

test("a pasted token is checked with a fresh Copilot runtime, then saved for later sessions", async () => {
  const login = channel("token", "  github_pat_secret \n");
  const { value, state } = deps((token) => token === "github_pat_secret");
  await runLogin(value, { action: "login" }, login.channel);
  expect(state.checks).toEqual(["github_pat_secret"]);
  expect(state.saved).toBe("github_pat_secret");
  expect(login.requested).toEqual([
    expect.objectContaining({ type: "select" }),
    expect.objectContaining({ type: "input", secret: true }),
  ]);
  expect(JSON.stringify(login.emitted)).not.toContain("github_pat_secret");
  expect(tokenEnv(state.saved)).toEqual({ COPILOT_GITHUB_TOKEN: "github_pat_secret" });
});

test("a token Copilot rejects is not saved", async () => {
  const { value, state } = deps(() => false);
  await expect(runLogin(value, { action: "login", method: "token" }, channel("ghp_classic").channel)).rejects.toThrow(
    "did not accept",
  );
  expect(state.saved).toBeUndefined();
});

test("the GitHub CLI method waits until Copilot sees the login, and gives up after a while", async () => {
  const saved = { ...CLI_LOGIN };
  Object.assign(CLI_LOGIN, { intervalMs: 1, timeoutMs: 1_000 });
  try {
    let checks = 0;
    const login = channel("gh-cli");
    await runLogin(deps(() => ++checks >= 3).value, { action: "login" }, login.channel);
    expect(checks).toBe(3);
    expect(login.emitted).toEqual([
      expect.objectContaining({ type: "message", message: expect.stringContaining("gh auth login") }),
    ]);
    Object.assign(CLI_LOGIN, { timeoutMs: 20 });
    await expect(
      runLogin(deps(() => false).value, { action: "login", method: "gh-cli" }, channel().channel),
    ).rejects.toThrow("did not see");
  } finally {
    Object.assign(CLI_LOGIN, saved);
  }
});

test("signing out removes a saved token; a GitHub CLI login is left to gh", async () => {
  const signedInWithToken = deps(() => true, "github_pat_secret");
  await runLogin(signedInWithToken.value, { action: "logout" }, channel().channel);
  expect(signedInWithToken.state.saved).toBeUndefined();
  await expect(runLogin(deps(() => true).value, { action: "logout" }, channel().channel)).rejects.toThrow(
    "gh auth logout",
  );
  expect(describeAuthentication(true, true).providers[0]?.canLogout).toBe(true);
  expect(describeAuthentication(true, false).providers[0]?.canLogout).toBe(false);
});

test("every Copilot runtime the harness starts receives the saved token", async () => {
  const copilot = fakeCopilot(() => []);
  const envs: (Record<string, string | undefined> | undefined)[] = [];
  const harness = createCopilotHarness((options) => {
    envs.push(options.env);
    return copilot.client;
  });
  const ctx = harnessContext(new Map<string, unknown>([["githubToken", "github_pat_saved"]]));
  expect(await harness.getAuthentication(ctx)).toMatchObject({
    status: "signed_in",
    providers: [{ canLogout: true }],
  });
  await harness.listModels(ctx);
  const session = await harness.start(ctx, {
    prompt: "x",
    sessionId: "host",
    events: { getMessages: () => [], push() {} },
  });
  await session.stop();
  expect(envs).toHaveLength(3);
  for (const env of envs) expect(env).toMatchObject({ COPILOT_GITHUB_TOKEN: "github_pat_saved" });
});

test("choosing the GitHub CLI drops a saved token, and a cancelled token sign-in saves nothing", async () => {
  const saved = { ...CLI_LOGIN };
  Object.assign(CLI_LOGIN, { intervalMs: 1 });
  try {
    const cli = deps(() => true, "github_pat_old");
    await runLogin(cli.value, { action: "login", method: "gh-cli" }, channel().channel);
    expect(cli.state.saved).toBeUndefined();
  } finally {
    Object.assign(CLI_LOGIN, saved);
  }
  const controller = new AbortController();
  const cancelled = deps((token) => {
    controller.abort();
    return token === "github_pat_new";
  });
  const login = channel("github_pat_new");
  await expect(
    runLogin(cancelled.value, { action: "login", method: "token" }, { ...login.channel, signal: controller.signal }),
  ).rejects.toThrow();
  expect(cancelled.state.saved).toBeUndefined();
});
