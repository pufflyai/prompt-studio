import type { HarnessParamsInfo } from "pstdio-api-contracts";

export type AgentInfo = {
  id: string;
  name: string;
  availability: {
    type: "INSTALLED" | "NOT_FOUND";
  };
  params?: HarnessParamsInfo;
};

export type AgentModel = {
  id: string;
};
