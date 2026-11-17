import type { AgentInfo, HarnessAuthentication } from "pstdio-api-contracts";

/** Local account discovery must settle before the host dispatches ordinary chat work. */
export const nativeHarnessReady = (input: {
  remote?: boolean;
  agentsChecked: boolean;
  agent?: Pick<AgentInfo, "availability" | "supportsModels">;
  authenticationChecked: boolean;
  status?: HarnessAuthentication["status"];
  model?: string;
  authenticating: boolean;
}) => {
  if (input.remote) return true;
  return (
    input.agentsChecked &&
    input.agent?.availability.type === "INSTALLED" &&
    input.authenticationChecked &&
    input.status !== "signed_out" &&
    !input.authenticating &&
    (!input.agent.supportsModels || Boolean(input.model))
  );
};
