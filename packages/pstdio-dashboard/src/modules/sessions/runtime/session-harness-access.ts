import type { AgentInfo, HarnessAuthentication } from "pstdio-api-contracts";

export const sessionHarnessAccess = (
  agents: AgentInfo[],
  selectedAgent: string,
  checked: boolean,
  status?: HarnessAuthentication["status"],
) => {
  if (!checked) return "checking";
  const installed = agents.filter((agent) => agent.availability.type === "INSTALLED");
  if (!installed.length) return "missing";
  if (installed.some((agent) => agent.id === selectedAgent) && status === "signed_out") return "signed_out";
  return "ready";
};
