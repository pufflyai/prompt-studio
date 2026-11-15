import type {
  HarnessAuthentication,
  HarnessAuthenticationChannel,
  HarnessAuthenticationInput,
} from "@pstdio/sdk/extensions";
import type { CopilotClientHandle } from "./client";

const methods = [
  { id: "gh-cli", label: "GitHub CLI (gh auth login)", kind: "oauth" as const },
  { id: "token", label: "GitHub token", kind: "api_key" as const },
];

export const readAuthentication = async (client: CopilotClientHandle): Promise<HarnessAuthentication> => {
  const { isAuthenticated } = await client.getAuthStatus();
  const status = isAuthenticated ? ("signed_in" as const) : ("signed_out" as const);
  // Copilot also reuses the GitHub CLI login, which this harness must not remove.
  return {
    status,
    provider: "github",
    providers: [{ id: "github", label: "GitHub", status, methods, canLogout: false }],
  };
};

/** How often, and for how long, the GitHub CLI method checks whether Copilot sees the new login. */
export const CLI_LOGIN = { intervalMs: 2_000, timeoutMs: 10 * 60_000 };

const chooseMethod = (channel: HarnessAuthenticationChannel) =>
  channel.request({
    type: "select",
    title: "Sign in to GitHub Copilot",
    options: [
      {
        id: "gh-cli",
        label: "GitHub CLI",
        description: "Run `gh auth login` in a terminal on this computer.",
        kind: "oauth",
      },
      {
        id: "token",
        label: "GitHub token",
        description: "Paste a token with Copilot access. It stays in Copilot's credential store.",
        kind: "api_key",
      },
    ],
    initial: "gh-cli",
  });

// The dialog stays open while the flow runs, so wait for the login instead of returning at once.
const waitForCliLogin = async (client: CopilotClientHandle, channel: HarnessAuthenticationChannel) => {
  await channel.emit({
    type: "message",
    message: "Run `gh auth login` in a terminal on this computer. This finishes when Copilot sees the login.",
  });
  const deadline = Date.now() + CLI_LOGIN.timeoutMs;
  while (Date.now() < deadline) {
    channel.signal.throwIfAborted();
    if ((await client.getAuthStatus()).isAuthenticated) return;
    await Bun.sleep(CLI_LOGIN.intervalMs);
  }
  throw new Error("Copilot did not see a GitHub CLI login. Run `gh auth login`, then sign in again.");
};

/** Token replies travel only on the account channel, never in chat history or command events. */
export const runLogin = async (
  client: CopilotClientHandle,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
) => {
  if (input.action === "logout") throw new Error("Sign out with `gh auth logout` or Copilot's own `/logout`.");
  const method = input.method ?? (await chooseMethod(channel));
  channel.signal.throwIfAborted();
  if (method !== "token") return waitForCliLogin(client, channel);
  const token = await channel.request({ type: "input", title: "GitHub token with Copilot access", secret: true });
  channel.signal.throwIfAborted();
  await client.storeToken(token.trim());
  if (!(await client.getAuthStatus()).isAuthenticated) throw new Error("GitHub did not accept this token for Copilot.");
};
