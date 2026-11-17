import type {
  HarnessAuthentication,
  HarnessAuthenticationChannel,
  HarnessAuthenticationInput,
} from "@pstdio/sdk/extensions";

const methods = [
  { id: "gh-cli", label: "GitHub CLI (gh auth login)", kind: "oauth" as const },
  { id: "token", label: "GitHub token", kind: "api_key" as const },
];

/** Harness state key for a token signed in through Prompt Studio. */
export const TOKEN_KEY = "githubToken";

/** Environment that hands a saved token to a Copilot runtime. Copilot prefers it over other logins. */
export const tokenEnv = (token: string | undefined): Record<string, string> =>
  token ? { COPILOT_GITHUB_TOKEN: token } : {};

export const describeAuthentication = (signedIn: boolean, savedToken: boolean): HarnessAuthentication => {
  const status = signedIn ? ("signed_in" as const) : ("signed_out" as const);
  // Only a token saved here can be removed here; a GitHub CLI login belongs to gh.
  return {
    status,
    provider: "github",
    providers: [{ id: "github", label: "GitHub", status, methods, canLogout: savedToken }],
  };
};

/** How often, and for how long, the GitHub CLI method checks whether Copilot sees the new login. */
export const CLI_LOGIN = { intervalMs: 2_000, timeoutMs: 10 * 60_000 };

/**
 * What sign-in needs from the harness. Each check starts a fresh Copilot runtime, so a result
 * reflects what the next session will see.
 */
export interface LoginDeps {
  /** Whether Copilot signs in with this token, or with its own logins when the token is absent. */
  signedIn(token?: string): Promise<boolean>;
  savedToken(): Promise<string | undefined>;
  saveToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

const chooseMethod = (channel: HarnessAuthenticationChannel) =>
  channel.request({
    type: "select",
    title: "Sign in to GitHub Copilot",
    options: [
      {
        id: "gh-cli",
        label: "GitHub CLI",
        description: "Run gh auth login in a terminal on this computer.",
        kind: "oauth",
      },
      {
        id: "token",
        label: "GitHub token",
        description: "Paste a fine-grained token with the Copilot Requests permission.",
        kind: "api_key",
      },
    ],
    initial: "gh-cli",
  });

// The dialog stays open while the flow runs, so wait for the login instead of returning at once.
const waitForCliLogin = async (deps: LoginDeps, channel: HarnessAuthenticationChannel) => {
  await channel.emit({
    type: "message",
    message: "Run gh auth login in a terminal on this computer. This finishes when Copilot sees the login.",
  });
  const deadline = Date.now() + CLI_LOGIN.timeoutMs;
  while (Date.now() < deadline) {
    channel.signal.throwIfAborted();
    if (await deps.signedIn()) return;
    await Bun.sleep(CLI_LOGIN.intervalMs);
  }
  throw new Error("Copilot did not see a GitHub CLI login. Run gh auth login, then sign in again.");
};

/**
 * A pasted token is saved in Prompt Studio's private harness state, not Copilot's keychain, which
 * does not exist on headless Linux hosts. Token replies stay on the account channel, never in chat
 * history or command events.
 */
export const runLogin = async (
  deps: LoginDeps,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
) => {
  if (input.action === "logout") {
    if (!(await deps.savedToken())) throw new Error("Sign out with gh auth logout or the Copilot CLI's /logout.");
    await deps.clearToken();
    return;
  }
  const method = input.method ?? (await chooseMethod(channel));
  channel.signal.throwIfAborted();
  if (method !== "token") {
    await waitForCliLogin(deps, channel);
    // A saved token would otherwise keep overriding the GitHub CLI login the person just chose.
    channel.signal.throwIfAborted();
    await deps.clearToken();
    return;
  }
  const reply = await channel.request({ type: "input", title: "GitHub token with Copilot access", secret: true });
  const token = reply.trim();
  channel.signal.throwIfAborted();
  if (!token || !(await deps.signedIn(token)))
    throw new Error("GitHub did not accept this token for Copilot. Use a fine-grained token with Copilot Requests.");
  // The dialog may have closed while the check ran; never save a token for a cancelled sign-in.
  channel.signal.throwIfAborted();
  await deps.saveToken(token);
};
