export type AgentInfo = {
  id: string;
  name: string;
  availability: {
    type: "INSTALLED" | "NOT_FOUND";
  };
};

export type AgentModel = {
  id: string;
};

export type ClaudeCodeSettings = {
  model?: string;
  planMode?: boolean;
  approvalMode?: "bypass" | "prompt";
};

export type OpencodeSettings = {
  model?: string;
  autoApprove?: boolean;
};
