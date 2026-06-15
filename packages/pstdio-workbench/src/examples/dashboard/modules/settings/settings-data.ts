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

export type DashboardTemplateType = string;

export interface DashboardTemplate {
  id: string;
  name: string;
  title: string;
  type: DashboardTemplateType;
  content: string;
}

// In-memory mock for the Templates collection — mirrors the real dashboard, which
// groups project templates by their contributor-supplied type and edits them in
// place. Types are intentionally extension-shaped (not framework-known) so the
// example demonstrates that the host treats `type` as an opaque string.
const templates: DashboardTemplate[] = [
  { id: "tpl-recipe", name: "weekday-dinner", title: "Weekday dinner", type: "recipe", content: "## Ingredients\n" },
  { id: "tpl-checklist", name: "launch", title: "Launch", type: "checklist", content: "- [ ] Tag release\n" },
  { id: "tpl-report", name: "weekly", title: "Weekly", type: "report", content: "## Highlights\n" },
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
      type: "recipe",
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
