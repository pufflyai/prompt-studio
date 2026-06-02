import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../../../core";
import { createWorkbenchSettingsModule, settingsPanelResource } from "../../../../react";
import { dashboardDefaultSettingsPanel } from "../../shared/mock-data/resources";
import { SettingsWidget } from "./components/settings-widget";
import { TemplateEditor } from "./components/template-editor";
import { type DashboardTemplateType, dashboardRuntimePreferenceSchema, dashboardTemplateStore } from "./settings-data";

const DEMO_PROJECT_ID = "acme";

const TEMPLATE_GROUP_ORDER: DashboardTemplateType[] = ["prompt", "ticket", "document"];
const TEMPLATE_GROUP_LABELS: Record<DashboardTemplateType, string> = {
  prompt: "Prompts",
  ticket: "Tickets",
  document: "Documents",
};

// Registers the dashboard's settings entries against the workbench settings
// registry. Mirrors the real dashboard: a schema-driven Runtime panel, a Templates
// collection grouped by type, and an extension-contributed custom panel. The
// unified surface turns these into the navigation tree and dispatching panel.
const registerSettingsContributions = (ctx: WorkbenchModuleContributionContext) => {
  ctx.preferences.registerSchema(dashboardRuntimePreferenceSchema);

  ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
  ctx.settings.registerSection({ id: "project", title: "Project", order: 20, scope: "project" });
  ctx.settings.registerSection({ id: "extensions", title: "Extensions", order: 30 });

  // Schema page — controls auto-generated from the registered preference schema.
  ctx.settings.registerPanel({
    kind: "schema",
    id: dashboardDefaultSettingsPanel.id,
    title: "Runtime",
    section: "workbench",
    scope: "global",
    icon: "Cpu",
    description: "Global runtime preferences — saved per user, applied live.",
    preferences: [
      { name: "dashboard.runtime.maxConcurrentSessions", label: "Max concurrent sessions" },
      { name: "dashboard.runtime.telemetry", label: "Share telemetry" },
      { name: "dashboard.runtime.logLevel", label: "Log level" },
    ],
  });

  // Collection page — per-template editors grouped by type, with a create action.
  ctx.settings.registerPanel({
    kind: "collection",
    id: "templates",
    title: "Templates",
    section: "project",
    scope: "project",
    icon: "FileText",
    items: () => dashboardTemplateStore.list(),
    itemId: (template) => template.id,
    itemLabel: (template) => template.title,
    groupBy: {
      key: (template) => template.type,
      order: TEMPLATE_GROUP_ORDER,
      label: (key) => TEMPLATE_GROUP_LABELS[key as DashboardTemplateType] ?? key,
    },
    renderItem: (template) => (
      <TemplateEditor
        key={template.id}
        template={template}
        onSave={(content) => dashboardTemplateStore.update(template.id, content)}
        onDelete={() => {
          dashboardTemplateStore.remove(template.id);
          ctx.settings.refresh();
          void ctx.resources.openResource(settingsPanelResource(dashboardDefaultSettingsPanel), {
            replaceActive: true,
          });
        }}
      />
    ),
    actions: [
      {
        id: "create",
        label: "New template",
        icon: "Plus",
        run: () => {
          dashboardTemplateStore.create();
          ctx.settings.refresh();
        },
      },
    ],
  });

  // Custom page — an extension renders its own settings surface (mock webview).
  ctx.settings.registerPanel({
    kind: "custom",
    id: "lab",
    title: "Lab settings",
    section: "extensions",
    icon: "FlaskConical",
    render: () => (
      <SettingsWidget title="Lab settings" contributor="extension-lab" entry="lab-settings.tsx" icon="FlaskConical" />
    ),
  });
};

// The settings slice: registers settings entries against the shared workbench
// settings surface. The surface owns the overlay, the nav, and the opener, so
// opening a settings resource pops a full-window modal — no host mode or opener.
export const createSettingsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.settings",
  activate(ctx) {
    registerSettingsContributions(ctx);

    return createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? DEMO_PROJECT_ID : undefined),
    }).activate(ctx);
  },
});
