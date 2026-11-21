import type { ToolShapeKind } from "./tool-shapes";

export const BUILDING_BLOCKS = [
  {
    kind: "page",
    docs: "/docs/references/workbench/overview/#pages",
    name: "Pages",
    detail: "Give your tool an interface.",
    example: "Dashboards, boards, forms, and custom views.",
  },
  {
    kind: "editor",
    docs: "/docs/guides/extensions/workbench-cookbook/#editor-collections",
    name: "Editors",
    detail: "Work with files your way.",
    example: "A storyboard, a CSV editor, or a document review tool.",
  },
  {
    kind: "command",
    docs: "/docs/references/extensions/command-and-process-api/",
    name: "Commands",
    detail: "Add an action you or your agent can run.",
    example: "Create a report, import feedback, or publish an update.",
  },
  {
    kind: "skill",
    docs: "/docs/guides/concepts/agents/#skills",
    name: "Skills",
    detail: "Teach your agent how you work.",
    example: "Your review checklist, writing style, or research method.",
  },
  {
    kind: "hook",
    docs: "/docs/references/extensions/command-and-process-api/#middlewares-and-hooks",
    name: "Hooks",
    detail: "Run an action when something happens.",
    example: "Check a result when an agent finishes its work.",
  },
  {
    kind: "automation",
    docs: "/docs/guides/extensions/automation/#run-a-command-on-a-schedule",
    name: "Schedules",
    detail: "Give repeated work a time to run.",
    example: "A morning brief, a weekly report, or a regular check.",
  },
] satisfies { kind: ToolShapeKind; docs: string; name: string; detail: string; example: string }[];
