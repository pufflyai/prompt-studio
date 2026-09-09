import type { ToolShapeKind } from "./tool-shapes";

export type ToolExampleId = "icons" | "shaders" | "agents" | "formulas";

export const TOOL_EXAMPLES: {
  id: ToolExampleId;
  name: string;
  blocks: { kind: ToolShapeKind; purpose: string }[];
}[] = [
  {
    id: "agents",
    name: "Coding agent dashboard",
    blocks: [
      { kind: "page", purpose: "Track tasks across your agents on a kanban board." },
      { kind: "command", purpose: "Assign a task to an agent or start a run." },
      { kind: "skill", purpose: "Give your agents your coding and review guidelines." },
      { kind: "hook", purpose: "Move a task to review when an agent finishes." },
      { kind: "automation", purpose: "Get a morning summary of completed runs and results to review." },
    ],
  },
  {
    id: "icons",
    name: "Icon set editor",
    blocks: [
      { kind: "page", purpose: "Browse and search your icon set." },
      { kind: "editor", purpose: "Inspect an icon, its name, and its codepoint." },
      { kind: "command", purpose: "Rename an icon across your set." },
    ],
  },
  {
    id: "shaders",
    name: "Shader editor",
    blocks: [
      { kind: "page", purpose: "Pick an icon and watch the shader paint it in real time." },
      { kind: "editor", purpose: "Edit the shader and reuse icons from your icon set." },
      { kind: "hook", purpose: "Refresh the preview when the selected icon or shader changes." },
    ],
  },
  {
    id: "formulas",
    name: "Financial formulas",
    blocks: [
      { kind: "page", purpose: "Explore savings plans, loan repayment, and discounted cash flow." },
      { kind: "editor", purpose: "Adjust the inputs and explore what each formula does." },
      { kind: "command", purpose: "Let an agent call a formula to answer a question with calculated results." },
    ],
  },
];
