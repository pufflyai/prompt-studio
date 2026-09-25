import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeSmokeChecks, type SmokeResult } from "./smoke-result";

export const finishExtensionSmoke = async (input: {
  root?: string;
  keepHome?: boolean;
  result: SmokeResult;
  closeBrowser?: () => Promise<unknown>;
  closeHost?: () => Promise<unknown>;
}) => {
  for (const close of [input.closeBrowser, input.closeHost]) {
    try {
      await close?.();
    } catch (error) {
      input.result.exitCode = 3;
      input.result.checks.push({
        id: "setup",
        status: "failed",
        phase: "cleanup",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  completeSmokeChecks(input.result);
  if (!input.root) return;
  if (input.keepHome) writeFileSync(join(input.root, "result.json"), JSON.stringify(input.result, null, 2));
  else rmSync(input.root, { recursive: true, force: true });
};
