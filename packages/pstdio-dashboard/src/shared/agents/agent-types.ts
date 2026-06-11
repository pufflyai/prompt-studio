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
