import type { SessionsRouteDeps } from "../../sessions/deps";
import { resolvePrompt } from "../../sessions/resolve-prompt";
import type { ExtensionsRouteDeps } from "../deps";

export const resolveExtensionPrompt = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { prompt?: string; template?: string; vars?: Record<string, unknown> },
) =>
  resolvePrompt(
    {
      prompt: input.prompt,
      template: input.template,
      vars: input.vars as Record<string, string> | undefined,
    },
    projectId,
    deps as SessionsRouteDeps,
  );

export const resolveHarnessInput = (harness: unknown) => {
  if (!harness || typeof harness !== "object") return {};
  const input = harness as { harnessId?: unknown; model?: unknown };
  return {
    agent: typeof input.harnessId === "string" ? input.harnessId : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
  };
};
