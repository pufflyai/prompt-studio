export type AgentInfo = {
  id: string;
  name: string;
  availability: {
    type: "INSTALLED" | "NOT_FOUND";
  };
};

export type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
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
