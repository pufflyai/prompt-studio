import type { FormulaId, FormulaValues } from "../services/financial-formulas";

export const DEMO_CLI_EVENT = "prompt-studio:demo-command";
export const CURSOR_CHAT_WIDTH = 288;
export const CURSOR_CHAT_HEIGHT = 32;

export type DemoCliCommand =
  | { tool: "icons"; id: string; name: string }
  | { tool: "shaders"; scale: number; speed: number }
  | { tool: "agents"; id: string }
  | { tool: "formulas"; id: FormulaId; inputs: FormulaValues };

export const demoCliText = (command: DemoCliCommand) => {
  if (command.tool === "icons") return `pst icons rename --id ${command.id} --name ${command.name}`;
  if (command.tool === "shaders") return `pst shaders update --scale ${command.scale} --speed ${command.speed}`;
  if (command.tool === "agents") return `pst tickets update --id ${command.id} --status "In Progress"`;
  const flags = Object.entries(command.inputs)
    .map(([key, value]) => `--${key} ${value}`)
    .join(" ");
  return `pst formulas calculate --id ${command.id} ${flags}`;
};

export const demoCliResult = (command: DemoCliCommand) => {
  if (command.tool === "icons") return "✓ Icon renamed";
  if (command.tool === "shaders") return "✓ Preview updated";
  if (command.tool === "agents") return "✓ Ticket moved to In progress";
  return "✓ Calculation updated";
};
