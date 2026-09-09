import type { SessionCompletionStatus } from "@pstdio/ui";
import { EXAMPLE_ICONS, type ExampleIcon } from "./icon-set-content";
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
      { kind: "command", purpose: "Pause a run or approve a result." },
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

export const EXAMPLE_AGENTS: {
  id: string;
  title: string;
  agent: string;
  kind: ToolShapeKind;
  status: SessionCompletionStatus;
  progress: number;
  filesChanged: number;
  previewIcons: ExampleIcon[];
}[] = [
  {
    id: "icons",
    title: "Add navigation icons",
    agent: "Codex",
    kind: "command",
    status: "in_progress",
    progress: 11,
    filesChanged: 3,
    previewIcons: EXAMPLE_ICONS.slice(0, 6),
  },
  {
    id: "outlines",
    title: "Refine icon outlines",
    agent: "Claude Code",
    kind: "skill",
    status: "awaiting_input",
    progress: 16,
    filesChanged: 2,
    previewIcons: EXAMPLE_ICONS.slice(6),
  },
  {
    id: "coverage",
    title: "Check the icon set",
    agent: "OpenCode",
    kind: "automation",
    status: "in_progress",
    progress: 7,
    filesChanged: 2,
    previewIcons: EXAMPLE_ICONS,
  },
];
