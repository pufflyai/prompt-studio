const HARNESS_PREFIX = "pstdio.harness.";

export const toHarnessId = (agentId: string) =>
  agentId.startsWith(HARNESS_PREFIX) ? agentId : `${HARNESS_PREFIX}${agentId}`;

export const toAgentId = (harnessId: string) =>
  harnessId.startsWith(HARNESS_PREFIX) ? harnessId.slice(HARNESS_PREFIX.length) : harnessId;
