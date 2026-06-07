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

export type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};
