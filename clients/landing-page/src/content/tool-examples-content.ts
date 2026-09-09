import type { SessionCompletionStatus } from "@pstdio/ui";
import type { ToolShapeKind } from "./tool-shapes";

export type ToolExampleId = "font" | "agents";

export const TOOL_EXAMPLES: {
  id: ToolExampleId;
  name: string;
  blocks: { kind: ToolShapeKind; purpose: string }[];
}[] = [
  {
    id: "font",
    name: "Font editor",
    blocks: [
      { kind: "page", purpose: "Preview your typeface as you change it." },
      { kind: "editor", purpose: "Pick a glyph and adjust the font weight." },
      { kind: "command", purpose: "Switch between a specimen and the full glyph set." },
    ],
  },
  {
    id: "agents",
    name: "Coding agents",
    blocks: [
      { kind: "page", purpose: "See your agents, their progress, and what they are building." },
      { kind: "command", purpose: "Pause a run or approve a result." },
      { kind: "skill", purpose: "Give your agents your font design and review guidelines." },
      { kind: "hook", purpose: "Refresh the preview when an agent changes a file." },
      { kind: "automation", purpose: "Check glyph coverage every morning." },
    ],
  },
];

export const EXAMPLE_AGENTS: {
  id: string;
  title: string;
  agent: string;
  kind: ToolShapeKind;
  status: SessionCompletionStatus;
  progress: number;
  files: { name: string; added: number; removed: number }[];
}[] = [
  {
    id: "font",
    title: "Build the font",
    agent: "Codex",
    kind: "command",
    status: "in_progress",
    progress: 11,
    files: [
      { name: "glyphs/A.svg", added: 18, removed: 4 },
      { name: "glyphs/B.svg", added: 24, removed: 8 },
      { name: "workbench.woff2", added: 1, removed: 1 },
    ],
  },
  {
    id: "specimen",
    title: "Polish the specimen",
    agent: "Claude Code",
    kind: "skill",
    status: "awaiting_input",
    progress: 16,
    files: [
      { name: "specimen.tsx", added: 42, removed: 12 },
      { name: "type-scale.ts", added: 16, removed: 6 },
    ],
  },
  {
    id: "coverage",
    title: "Check glyph coverage",
    agent: "OpenCode",
    kind: "automation",
    status: "in_progress",
    progress: 7,
    files: [
      { name: "glyph-coverage.ts", added: 32, removed: 2 },
      { name: "coverage-report.json", added: 26, removed: 0 },
    ],
  },
];
