import type { PreferenceSchemaContribution } from "../../../../core";

// Runtime preferences for the schema-driven settings panel. Global (user) scope,
// auto-rendered by the workbench into a param editor.
export const dashboardRuntimePreferenceSchema = {
  properties: {
    "dashboard.runtime.maxConcurrentSessions": {
      type: "number",
      default: 4,
      scope: "user",
      description: "Maximum agent sessions running at once.",
    },
    "dashboard.runtime.telemetry": {
      type: "boolean",
      default: true,
      scope: "user",
      description: "Share anonymous usage metrics.",
    },
    "dashboard.runtime.logLevel": {
      type: "string",
      enum: ["error", "warn", "info", "debug"],
      default: "info",
      scope: "user",
      description: "Verbosity of runtime logs.",
    },
  },
} satisfies PreferenceSchemaContribution;

export type DashboardTemplateType = "prompt" | "ticket" | "document";

export interface DashboardTemplate {
  id: string;
  name: string;
  title: string;
  type: DashboardTemplateType;
  content: string;
}

// In-memory mock for the Templates collection — mirrors the real dashboard, which
// groups project templates by type and edits them in place.
const templates: DashboardTemplate[] = [
  { id: "tpl-bug", name: "bug-report", title: "Bug report", type: "ticket", content: "## Steps to reproduce\n" },
  { id: "tpl-feature", name: "feature", title: "Feature", type: "ticket", content: "## Goal\n" },
  { id: "tpl-summary", name: "summary", title: "Summary", type: "prompt", content: "Summarize the following:\n" },
  { id: "tpl-prd", name: "prd", title: "PRD", type: "document", content: "# Product requirements\n" },
];

let created = 0;

export const dashboardTemplateStore = {
  list: () => [...templates],
  create: () => {
    created += 1;
    templates.push({
      id: `tpl-new-${created}`,
      name: `new-template-${created}`,
      title: `New template ${created}`,
      type: "prompt",
      content: "",
    });
  },
  update: (id: string, content: string) => {
    const template = templates.find((entry) => entry.id === id);
    if (template) template.content = content;
  },
  remove: (id: string) => {
    const index = templates.findIndex((entry) => entry.id === id);
    if (index >= 0) templates.splice(index, 1);
  },
};
