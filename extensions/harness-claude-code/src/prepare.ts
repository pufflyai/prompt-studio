import { type HarnessContext, prepareHarnessPackage } from "@pstdio/sdk/extensions";
import { resolveClaudeCommand, setClaudePackage } from "./cli";
export const prepareClaude = async (ctx: HarnessContext) => {
  const acquired = await prepareHarnessPackage(ctx, {
    command: [resolveClaudeCommand({ managed: () => null })],
    minimumVersion: "2.1.203",
    name: "@anthropic-ai/claude-code",
    version: "2.1.203",
  });
  setClaudePackage(acquired?.path ?? null);
};
