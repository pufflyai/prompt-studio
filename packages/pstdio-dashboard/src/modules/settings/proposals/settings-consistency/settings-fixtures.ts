import type { InputGroup } from "@pstdio/ui/param-editor";
import { plannerWorkflowGroup } from "./planner-fixtures";

// Synthetic values only. The proposal never reads or changes installation settings.
export const settingsPages: { id: string; title: string; icon: string; section: string; groups: InputGroup[] }[] = [
  {
    id: "runtime",
    title: "Runtime",
    icon: "Cpu",
    section: "workbench",
    groups: [
      {
        id: "capacity",
        title: "Session queue",
        params: [
          { id: "unlimited", name: "Unlimited concurrent sessions", type: "boolean", defaultValue: false },
          {
            id: "concurrency",
            name: "Concurrent sessions",
            type: "number",
            defaultValue: 4,
            min: 1,
            description:
              "Active sessions include sessions waiting for input. Lowering this limit leaves active sessions running.",
          },
        ],
      },
      {
        id: "defaults",
        title: "Project defaults",
        params: [
          {
            id: "harness",
            name: "Harness",
            type: "selection",
            defaultValue: "codex",
            options: [
              { id: "codex", name: "Codex" },
              { id: "claude", name: "Claude Code" },
            ],
          },
          {
            id: "model",
            name: "Model",
            type: "selection",
            defaultValue: "default",
            options: [
              { id: "default", name: "Harness default" },
              { id: "custom", name: "Project model" },
            ],
          },
          {
            id: "effort",
            name: "Reasoning effort",
            type: "selection",
            defaultValue: "high",
            options: [
              { id: "low", name: "Low" },
              { id: "medium", name: "Medium" },
              { id: "high", name: "High" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "appearance",
    title: "Appearance",
    icon: "Palette",
    section: "workbench",
    groups: [
      {
        id: "theme",
        title: "Theme",
        params: [
          {
            id: "theme-choice",
            name: "Color theme",
            type: "selection",
            defaultValue: "system",
            options: [
              { id: "system", name: "Follow system" },
              { id: "light", name: "Prompt Studio Light" },
              { id: "dark", name: "Prompt Studio Dark" },
            ],
          },
        ],
      },
      {
        id: "navigation",
        title: "Navigation",
        params: [
          {
            id: "related",
            name: "Open related resources",
            type: "boolean",
            defaultValue: true,
            description: "Open related resources alongside the current resource.",
          },
        ],
      },
    ],
  },
  {
    id: "updates",
    title: "Update channel",
    icon: "CloudDownload",
    section: "workbench",
    groups: [
      {
        id: "release",
        title: "Releases",
        params: [
          {
            id: "channel",
            name: "Update channel",
            type: "selection",
            defaultValue: "stable",
            options: [
              { id: "stable", name: "Stable" },
              { id: "nightly", name: "Nightly" },
            ],
            description: "Nightly builds include changes still being tested.",
          },
          { id: "version", name: "Current version", type: "readOnly", value: "0.46.0" },
        ],
      },
    ],
  },
  {
    id: "beta",
    title: "Beta features",
    icon: "FlaskConical",
    section: "experimental",
    groups: [
      {
        id: "features",
        title: "Experimental features",
        params: [
          { id: "notifications", name: "Notifications", type: "boolean", defaultValue: true },
          { id: "machine-tokens", name: "Machine tokens", type: "boolean", defaultValue: false },
        ],
      },
    ],
  },
  {
    id: "folder",
    title: "Project folder",
    icon: "GitBranch",
    section: "project",
    groups: [
      {
        id: "project",
        title: "Project",
        params: [
          { id: "name", name: "Project name", type: "text", defaultValue: "Prompt Studio", singleLine: true },
          { id: "path", name: "Project folder", type: "readOnly", value: "~/Projects/prompt-studio" },
        ],
      },
    ],
  },
  {
    id: "planner",
    title: "Workflow & automation",
    icon: "Workflow",
    section: "planner",
    groups: [
      {
        id: "implementation",
        title: "Implementation",
        params: [
          { id: "canvas", name: "Update Canvas design", type: "boolean", defaultValue: true },
          { id: "review", name: "Adversarial review", type: "boolean", defaultValue: true },
          {
            id: "target",
            name: "Target branch",
            type: "selection",
            defaultValue: "origin/main",
            options: [
              { id: "origin/main", name: "origin/main" },
              { id: "origin/release", name: "origin/release" },
            ],
          },
        ],
      },
      {
        id: "automation",
        title: "Automation",
        params: [{ id: "tickets", name: "Maximum in-progress tickets", type: "number", defaultValue: 2, min: 1 }],
      },
      plannerWorkflowGroup,
    ],
  },
  { id: "ticket-status", title: "Ticket status", icon: "status-progress", section: "planner", groups: [] },
  { id: "ticket-tags", title: "Ticket tags", icon: "tag", section: "planner", groups: [] },
  { id: "danger-zone", title: "Danger zone", icon: "TriangleAlert", section: "project", groups: [] },
];
