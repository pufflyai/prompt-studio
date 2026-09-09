import { EXAMPLE_ICONS } from "./icon-set-content";
import type { ToolShapeKind } from "./tool-shapes";

export const WORKFLOW_ICONS = EXAMPLE_ICONS.slice(0, 6);

export const WORKFLOW_STEPS = [
  {
    id: "draw",
    title: "Draw the icons",
    agent: "Codex",
    kind: "command",
    actions: ["Codex started", "Drawing navigation icons", "Adding interface icons", "Saving the icon set"],
  },
  {
    id: "refine",
    title: "Refine the outlines",
    agent: "Claude Code",
    kind: "skill",
    actions: ["Claude Code started", "Matching stroke widths", "Adjusting small details", "Saving refined icons"],
  },
  {
    id: "check",
    title: "Check the icon set",
    agent: "OpenCode",
    kind: "hook",
    actions: ["OpenCode started", "Checking SVG files", "Verifying codepoints", "Writing the summary"],
  },
] satisfies { id: string; title: string; agent: string; kind: ToolShapeKind; actions: string[] }[];

export const WORKFLOW_FRAME_MS = 1600;
export const WORKFLOW_FRAMES = WORKFLOW_STEPS.flatMap((step, stepIndex) =>
  step.actions.map((action, actionIndex) => ({ stepIndex, actionIndex, action })),
);
export const WORKFLOW_RESTART_FRAMES = 3;
