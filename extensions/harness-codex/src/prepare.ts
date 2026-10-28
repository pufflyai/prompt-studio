import { type HarnessContext, prepareHarnessPackage } from "@pstdio/sdk/extensions";
import { resolveCodexCommand } from "./codex-process";
import { setCodexPackage } from "./managed-cli";
export const prepareCodex = async (ctx: HarnessContext) => {
  const acquired = await prepareHarnessPackage(ctx, {
    command: [resolveCodexCommand({ managed: () => null })],
    minimumVersion: "0.157.0",
    name: "@openai/codex",
    version: "0.162.0",
  });
  setCodexPackage(acquired?.path ?? null);
};
