import type { createAppServerTransport } from "./app-server-transport";
import type { StartSpawnInput } from "./session-input";
export const codexThreadConfig = async (rpc: ReturnType<typeof createAppServerTransport>, input: StartSpawnInput) => {
  const result = (await rpc.request("config/read", { cwd: input.cwd }, undefined, input.signal)) as {
    config?: { shell_environment_policy?: { set?: Record<string, string>; include_only?: string[] } };
  };
  const policy = result.config?.shell_environment_policy;
  const values = { ...policy?.set };
  values.PSTDIO_SESSION_ID = input.env?.PSTDIO_SESSION_ID ?? "";
  // Native config tables merge; blank values clear stale attribution from lower layers (ADR 0122).
  values.PSTDIO_PROJECT_ID = input.env?.PSTDIO_PROJECT_ID ?? "";
  return {
    ...(input.params?.model_reasoning_effort ? { model_reasoning_effort: input.params.model_reasoning_effort } : {}),
    "shell_environment_policy.set": values,
    ...(policy?.include_only?.length
      ? {
          "shell_environment_policy.include_only": [
            ...new Set([...policy.include_only, "PSTDIO_SESSION_ID", "PSTDIO_PROJECT_ID"]),
          ],
        }
      : {}),
  };
};
