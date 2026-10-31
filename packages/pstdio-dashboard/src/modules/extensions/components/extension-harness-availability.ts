import type { ProjectExtensionInstance, WorkbenchExtensionHarnessRecord } from "@pstdio/sdk/api";
import type { AgentInfo } from "pstdio-api-contracts";

export const unavailableExtensionHarnesses = (
  extension: Pick<ProjectExtensionInstance, "extensionId" | "enabled">,
  harnesses: WorkbenchExtensionHarnessRecord[] | undefined,
  agents: AgentInfo[] | undefined,
) => {
  if (!extension.enabled) return [];
  const ownedIds = new Set(
    (harnesses ?? []).filter((harness) => harness.extensionId === extension.extensionId).map((harness) => harness.id),
  );
  return (agents ?? []).filter((agent) => ownedIds.has(agent.id) && agent.availability.type === "NOT_FOUND");
};
