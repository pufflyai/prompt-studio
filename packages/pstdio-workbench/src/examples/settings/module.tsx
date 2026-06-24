import type { WorkbenchModuleContribution } from "../../core";
import { createWorkbenchSettingsModule, settingsPanelResource } from "../../react";
import { CustomSettingsPanel } from "./components/custom-settings-panel";
import { SettingsLauncher } from "./components/settings-launcher";
import { SnippetEditor } from "./components/snippet-editor";
import { demoPreferenceSchema, demoSnippets } from "./demo-settings";

const DEMO_PROJECT_ID = "demo-project";
const LAUNCHER_WIDGET_ID = "onboarding.settings.launcher";
const LAUNCHER_RENDERER_ID = "onboarding.settings.launcher.renderer";

// Shows how a module adds settings entries: declare a preference schema + sections,
// then register panels (schema, custom, collection). The unified surface module
// renders the tree + dispatching panel + opener — no per-page wiring.
export const createSettingsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.settings",
  activate(ctx) {
    ctx.preferences.registerSchema(demoPreferenceSchema);

    ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    ctx.settings.registerSection({ id: "extensions", title: "Extensions", order: 20 });

    // Schema page (global, live save) — controls auto-generated from the schema.
    ctx.settings.registerPanel({
      kind: "schema",
      id: "appearance",
      title: "Appearance",
      section: "workbench",
      scope: "global",
      icon: "Palette",
      description: "Theme and density — saved per user, applied live.",
      preferences: [
        { name: "demo.appearance.theme", label: "Theme" },
        { name: "demo.appearance.density", label: "Density" },
        { name: "demo.appearance.badges", label: "Sidebar badges" },
      ],
    });

    // Schema page (project-scoped, explicit Save/Discard).
    ctx.settings.registerPanel({
      kind: "schema",
      id: "editor",
      title: "Editor",
      section: "workbench",
      scope: "project",
      icon: "PencilRuler",
      description: "Project-scoped editing preferences — staged behind Save.",
      save: "apply",
      preferences: [
        { name: "demo.editor.fontSize", label: "Font size" },
        { name: "demo.editor.wordWrap", label: "Word wrap" },
        { name: "demo.editor.rulers", label: "Rulers" },
      ],
    });

    // Custom page — the contributor renders its own component.
    ctx.settings.registerPanel({
      kind: "custom",
      id: "lab",
      title: "Lab",
      section: "extensions",
      scope: "global",
      icon: "FlaskConical",
      render: () => <CustomSettingsPanel />,
    });

    // Collection — per-item nodes grouped by category, each opening an item editor.
    ctx.settings.registerPanel({
      kind: "collection",
      id: "snippets",
      title: "Snippets",
      section: "extensions",
      scope: "project",
      icon: "Code",
      items: () => demoSnippets.list(),
      itemId: (item) => item.id,
      itemLabel: (item) => item.name,
      groupBy: { key: (item) => item.category, order: ["Prose", "Code"], label: (key) => key },
      renderItem: (item) => <SnippetEditor snippet={item} />,
      actions: [
        {
          id: "create",
          label: "Create snippet",
          icon: "Plus",
          run: () => {
            demoSnippets.create();
            ctx.settings.refresh();
          },
        },
      ],
    });

    // The unified surface renders everything above. Project entries appear because we
    // resolve a project scope id here.
    const surface = createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? DEMO_PROJECT_ID : undefined),
    }).activate(ctx);

    // The surface is a modal overlay; closing it would leave the lesson blank. A main-area
    // landing widget keeps a way back in by re-running the built-in open command.
    ctx.renderers.registerRenderer({
      id: LAUNCHER_RENDERER_ID,
      render: (input) => <SettingsLauncher input={input} />,
    });
    ctx.layout.registerWidget({
      id: LAUNCHER_WIDGET_ID,
      title: "Settings",
      area: "main",
      singleton: true,
      rendererId: LAUNCHER_RENDERER_ID,
    });
    ctx.layout.openWidget(LAUNCHER_WIDGET_ID);

    // Open the overlay so the lesson shows the surface immediately.
    void ctx.resources.openResource(settingsPanelResource({ id: "appearance", title: "Appearance", icon: "Palette" }));

    return surface;
  },
});
