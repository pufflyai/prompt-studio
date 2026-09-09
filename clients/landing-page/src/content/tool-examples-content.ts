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
    name: "Coding agents",
    blocks: [
      { kind: "page", purpose: "See your agents, their progress, and what they are building." },
      { kind: "command", purpose: "Start or pause a workflow across your agents." },
      { kind: "skill", purpose: "Give your agents your icon design and review guidelines." },
      { kind: "hook", purpose: "Refresh the preview when an agent changes a file." },
      { kind: "automation", purpose: "Get a morning summary of completed runs and results to review." },
    ],
  },
  {
    id: "formulas",
    name: "Formula glossary",
    blocks: [
      { kind: "page", purpose: "Keep useful formulas together with visual examples." },
      { kind: "editor", purpose: "Adjust the inputs and explore what each formula does." },
    ],
  },
];
