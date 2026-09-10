export const AGENT_BOARD_COLUMNS = [
  { id: "queued", label: "Queued", color: "gray" },
  { id: "running", label: "In progress", color: "blue" },
  { id: "review", label: "Ready for review", color: "green" },
];

export const SESSION_STAGES = ["coding", "saving", "finished", "hook", "reviewing", "ready"] as const;
export type AgentTaskStage = "queued" | (typeof SESSION_STAGES)[number];
export interface AgentBoardTask {
  id: string;
  title: string;
  agent: string;
  stage: AgentTaskStage;
}

export const AGENT_BOARD_TASKS: AgentBoardTask[] = [
  { id: "TOOL-18", title: "Add a color picker to the shader editor", agent: "Codex", stage: "queued" },
  { id: "TOOL-19", title: "Compare two savings scenarios", agent: "Claude Code", stage: "queued" },
  { id: "TOOL-16", title: "Use the icon set in the shader preview", agent: "Codex", stage: "coding" },
  { id: "TOOL-17", title: "Add a loan repayment command", agent: "OpenCode", stage: "saving" },
  { id: "TOOL-14", title: "Export icons as SVG", agent: "Claude Code", stage: "ready" },
  { id: "TOOL-15", title: "Plot compound growth over time", agent: "Codex", stage: "ready" },
];

export const STAGE_LABELS: Record<AgentTaskStage, string> = {
  queued: "Waiting to start",
  coding: "Building the change",
  saving: "Saving files and checking the result",
  finished: "Session completed",
  hook: "Hook triggered",
  reviewing: "Review session running",
  ready: "Review complete",
};

export const taskColumn = (stage: AgentTaskStage) => {
  if (stage === "queued") return "queued";
  if (["hook", "reviewing", "ready"].includes(stage)) return "review";
  return "running";
};

export const stageReached = (stage: AgentTaskStage, target: (typeof SESSION_STAGES)[number]) =>
  stage !== "queued" && SESSION_STAGES.indexOf(stage) >= SESSION_STAGES.indexOf(target);

export const isTaskActive = (stage: AgentTaskStage) => stage !== "queued" && stage !== "ready";
export const reviewAgent = (task: AgentBoardTask) => (task.agent === "Claude Code" ? "Codex" : "Claude Code");
