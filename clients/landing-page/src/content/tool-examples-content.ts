import type { ToolShapeKind } from "./tool-shapes";

export type ToolExampleId = "icons" | "shaders" | "agents" | "formulas";

export const TOOL_EXAMPLES: {
  id: ToolExampleId;
  slug: string;
  name: string;
  description: string;
  blocks: { kind: ToolShapeKind; purpose: string }[];
}[] = [
  {
    id: "agents",
    slug: "coding-agent-dashboard",
    name: "Coding agent dashboard",
    description:
      "Manage tickets across coding agents. Commands update the board, skills guide the work, and hooks and schedules keep it moving.",
    blocks: [
      { kind: "page", purpose: "Track tickets and agent sessions on a kanban board." },
      { kind: "command", purpose: "Create tickets, update their status, and list work to pick up or review." },
      { kind: "skill", purpose: "Teach agents how to implement a ticket and review a change." },
      { kind: "hook", purpose: "Move a ticket to review when an agent finishes." },
      {
        kind: "automation",
        purpose: "Pick up queued tickets each morning and prepare a review summary each afternoon.",
      },
    ],
  },
  {
    id: "icons",
    slug: "icon-set-editor",
    name: "Icon set editor",
    description: "Browse, rename, and organise the icons you use across your tools.",
    blocks: [
      { kind: "page", purpose: "Browse and search your icon set." },
      { kind: "editor", purpose: "Inspect an icon, its name, and its codepoint." },
      { kind: "command", purpose: "Rename an icon across your set." },
    ],
  },
  {
    id: "shaders",
    slug: "shader-editor",
    name: "Shader editor",
    description: "Edit a fragment shader and shape its animation with a live preview.",
    blocks: [
      { kind: "page", purpose: "Watch flowing ribbons of color respond to scale and speed." },
      { kind: "editor", purpose: "Edit the shader to change its colors and motion." },
      { kind: "hook", purpose: "Refresh the preview as you change the shader." },
    ],
  },
  {
    id: "formulas",
    slug: "financial-formulas",
    name: "Financial formulas",
    description: "Explore financial formulas and let agents use them to answer questions.",
    blocks: [
      { kind: "page", purpose: "Explore savings plans, loan repayment, and discounted cash flow." },
      { kind: "editor", purpose: "Adjust the inputs and explore what each formula does." },
      { kind: "command", purpose: "Let an agent call a formula to answer a question with calculated results." },
    ],
  },
];
