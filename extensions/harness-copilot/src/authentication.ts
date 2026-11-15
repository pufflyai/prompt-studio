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

/** Token replies travel only on the account channel, never in chat history or command events. */
export const runLogin = async (
  client: CopilotClientHandle,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
) => {
  if (input.action === "logout") throw new Error("Sign out with `gh auth logout` or Copilot's own `/logout`.");
  if (input.method !== "token") {
    await channel.emit({
      type: "message",
      message: "Run `gh auth login` in a terminal. Copilot uses the GitHub CLI login, then this session refreshes.",
    });
    return;
  }
  const token = await channel.request({ type: "input", title: "GitHub token with Copilot access", secret: true });
  channel.signal.throwIfAborted();
  await client.storeToken(token.trim());
  if (!(await client.getAuthStatus()).isAuthenticated) throw new Error("GitHub did not accept this token for Copilot.");
};
