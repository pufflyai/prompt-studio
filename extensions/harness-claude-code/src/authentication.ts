import {
  chooseHarnessAuthentication,
  type HarnessAuthentication,
  type HarnessContext,
  type HarnessProvider,
} from "@pstdio/sdk/extensions";
import { runClaudeAccountLogin } from "./account-action";
import { resolveClaudeCommand } from "./cli";
export const getClaudeAuthentication = async (ctx: HarnessContext) => {
  let status: HarnessAuthentication["status"] = "unknown";
  let canLogout = false;
  try {
    const result = await ctx.process.run({
      command: [resolveClaudeCommand(), "auth", "status"],
      env: { CLAUDECODE: "" },
      timeoutMs: 3_000,
    });
    const account = JSON.parse(result.stdout);
    if (typeof account.loggedIn === "boolean") {
      status = account.loggedIn ? "signed_in" : "signed_out";
      canLogout =
        account.loggedIn &&
        (account.authMethod === "claude.ai" ||
          (account.authMethod === "api_key" &&
            account.apiKeySource !== "apiKeyHelper" &&
            !process.env.ANTHROPIC_API_KEY));
    }
  } catch {}
  return {
    status,
    provider: "anthropic",
    providers: [
      {
        id: "anthropic",
        label: "Anthropic",
        status,
        canLogout,
        methods: [
          { id: "claudeai", label: "Claude subscription", kind: "oauth" },
          { id: "console", label: "Anthropic Console", kind: "oauth" },
        ],
      },
    ],
  } satisfies HarnessAuthentication;
};
export const authenticateClaude: NonNullable<HarnessProvider["authenticate"]> = async (ctx, input, channel) => {
  const choice = await chooseHarnessAuthentication(await getClaudeAuthentication(ctx), input, channel);
  if (!choice) return;
  if (input.action === "logout") {
    const result = await ctx.process.run({
      command: [resolveClaudeCommand(), "auth", "logout"],
      env: { CLAUDECODE: "" },
    });
    if (result.exitCode !== 0) throw new Error("Claude sign-out failed.");
    return;
  }
  await runClaudeAccountLogin(choice.method!, channel);
};
