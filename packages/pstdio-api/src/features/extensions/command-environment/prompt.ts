import type { HarnessParams } from "pstdio-api-contracts";
export const resolveExtensionPrompt = (input: { prompt?: string }) => input.prompt ?? "";

export const resolveHarnessInput = (harness: unknown) => {
  if (!harness || typeof harness !== "object") return {};
  const input = harness as { harnessId?: unknown; model?: unknown; params?: HarnessParams };
  return {
    agent: typeof input.harnessId === "string" ? input.harnessId : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
    params: input.params,
  };
};
