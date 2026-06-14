import { harnessLocalId } from "@pstdio/sdk/resources";
import { apiClient } from "@/features/api-client";

// CLI commands take bare agent ids (claude-code); configs store namespaced harness ids.
export const resolveHarnessId = async (agentId: string) => {
  const harnesses = await apiClient().agents.info();
  const match =
    harnesses.find((harness) => harness.id === agentId) ??
    harnesses.find((harness) => harnessLocalId(harness.id) === agentId);
  if (!match) {
    throw new Error(`No installed harness found for agent: ${agentId}`);
  }
  return match.id;
};
