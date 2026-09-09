import type { SessionCompletionStatus } from "@pstdio/ui";
import { EXAMPLE_ICONS, type ExampleIcon } from "./icon-set-content";
import type { ToolShapeKind } from "./tool-shapes";

export type ToolExampleId = "icons" | "agents";

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
      { kind: "automation", purpose: "Check your icon set every morning." },
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
  previewIcons: ExampleIcon[];
}[] = [
  {
    id: "icons",
    title: "Add navigation icons",
    agent: "Codex",
    kind: "command",
    status: "in_progress",
    progress: 11,
    files: [
      { name: "icons/cloud-add.svg", added: 18, removed: 4 },
      { name: "icons/history.svg", added: 24, removed: 8 },
      { name: "icon-set.json", added: 2, removed: 0 },
    ],
    previewIcons: EXAMPLE_ICONS.slice(0, 6),
  },
  {
    id: "outlines",
    title: "Refine icon outlines",
    agent: "Claude Code",
    kind: "skill",
    status: "awaiting_input",
    progress: 16,
    files: [
      { name: "icons/notification.svg", added: 12, removed: 6 },
      { name: "icons/magicpen.svg", added: 16, removed: 6 },
    ],
    previewIcons: EXAMPLE_ICONS.slice(6),
  },
  {
    id: "coverage",
    title: "Check the icon set",
    agent: "OpenCode",
    kind: "automation",
    status: "in_progress",
    progress: 7,
    files: [
      { name: "check-icons.ts", added: 32, removed: 2 },
      { name: "icon-report.json", added: 26, removed: 0 },
    ],
    previewIcons: EXAMPLE_ICONS,
  },
];
