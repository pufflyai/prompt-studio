import type { ToolShapeKind } from "../shapes/tool-shapes";

export const BUILDING_BLOCKS = [
  {
    kind: "page",
    name: "Pages",
    detail: "Give your tool an interface.",
    example: "Dashboards, boards, forms, and custom views.",
  },
  {
    kind: "editor",
    name: "Editors",
    detail: "Work with files your way.",
    example: "A storyboard, a CSV editor, or a document review tool.",
  },
  {
    kind: "command",
    name: "Commands",
    detail: "Add an action you or your agent can run.",
    example: "Create a report, import feedback, or publish an update.",
  },
  {
    kind: "skill",
    name: "Skills",
    detail: "Teach your agent how you work.",
    example: "Your review checklist, writing style, or research method.",
  },
  {
    kind: "hook",
    name: "Hooks",
    detail: "Run an action when something happens.",
    example: "Check a result when an agent finishes its work.",
  },
  {
    kind: "automation",
    name: "Schedules",
    detail: "Give repeated work a time to run.",
    example: "A morning brief, a weekly report, or a regular check.",
  },
] satisfies { kind: ToolShapeKind; name: string; detail: string; example: string }[];

export const blockFor = (kind: ToolShapeKind) => BUILDING_BLOCKS.find((block) => block.kind === kind)!;
