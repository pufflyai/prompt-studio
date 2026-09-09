export const AGENT_BOARD_COLUMNS = [
  { id: "queued", label: "Queued", color: "gray" },
  { id: "running", label: "In progress", color: "blue" },
  { id: "review", label: "Ready for review", color: "green" },
];

export const AGENT_BOARD_TASKS = [
  { id: "TOOL-18", title: "Add a color picker to the shader editor", agent: "Codex", column: "queued" },
  { id: "TOOL-19", title: "Compare two savings scenarios", agent: "Claude Code", column: "queued" },
  { id: "TOOL-16", title: "Build the icon set preview", agent: "Codex", column: "running" },
  { id: "TOOL-17", title: "Add sliders for shader uniforms", agent: "OpenCode", column: "running" },
  { id: "TOOL-14", title: "Export icons as SVG", agent: "Claude Code", column: "review" },
  { id: "TOOL-15", title: "Plot compound growth over time", agent: "Codex", column: "review" },
];
