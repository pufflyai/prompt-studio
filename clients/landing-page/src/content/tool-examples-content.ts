import type { ToolShapeKind } from "./tool-shapes";

export type ToolExampleId = "icons" | "agents" | "formulas";

export const TOOL_EXAMPLES: {
  id: ToolExampleId;
  name: string;
  blocks: { kind: ToolShapeKind; purpose: string }[];
}[] = [
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
    id: "formulas",
    name: "Financial formulas",
    blocks: [
      { kind: "page", purpose: "Explore growth, interest, and purchasing power in one glossary." },
      { kind: "editor", purpose: "Adjust the inputs and explore what each formula does." },
    ],
  },
];
