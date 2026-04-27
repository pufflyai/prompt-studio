const HARNESS_PREFIX = "pstdio.harness.";

type AgentConfigRecord = {
  agent_id: string;
};

export const toHarnessId = (agentId: string) =>
  agentId.startsWith(HARNESS_PREFIX) ? agentId : `${HARNESS_PREFIX}${agentId}`;

export const toAgentId = (harnessId: string) =>
  harnessId.startsWith(HARNESS_PREFIX) ? harnessId.slice(HARNESS_PREFIX.length) : harnessId;

export const toHarnessConfig = <TConfig extends AgentConfigRecord>(config: TConfig) => ({
  ...config,
  harness_id: toHarnessId(config.agent_id),
});
