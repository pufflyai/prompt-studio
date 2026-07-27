export const settingsSource = `import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";

// A module adds settings entries through the generic settings registry. The
// framework knows nothing about your data or editors — it renders sections, a
// schema-driven param editor, your custom views, and dynamic collections.
export const createSettingsModule = (): WorkbenchModuleContribution => ({
  id: "app.settings",
  activate(ctx) {
    // Typed, scoped preferences -> auto-generated param editor.
    ctx.preferences.registerSchema({
      properties: {
        "app.theme": { type: "string", enum: ["system", "light", "dark"], default: "system", scope: "user" },
      },
    });

    // Ordered sidenav sections (headerless when titleless).
    ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    ctx.settings.registerSection({ id: "extensions", title: "Extensions", order: 20 });

    // Schema page: workbench builds the controls. save: "apply" stages behind Save/Discard.
    ctx.settings.registerPanel({
      kind: "schema",
      id: "appearance",
      title: "Appearance",
      section: "workbench",
      scope: "global",
      preferences: ["app.theme"],
    });

    // Custom page: you render the component; the workbench just mounts it.
    ctx.settings.registerPanel({
      kind: "custom",
      id: "lab",
      title: "Lab",
      section: "extensions",
      render: () => <LabSettings />,
    });

    // Collection: data-driven per-item nodes (grouped, with a "+ create" action),
    // each opening your own editor. itemId/itemLabel/renderItem are yours.
    ctx.settings.registerPanel({
      kind: "collection",
      id: "snippets",
      title: "Snippets",
      section: "extensions",
      scope: "project",
      items: () => listSnippets(),
      itemId: (s) => s.id,
      itemLabel: (s) => s.name,
      groupBy: { key: (s) => s.category, order: ["Prose", "Code"], label: (k) => k },
      renderItem: (s) => <SnippetEditor snippet={s} />,
      actions: [{ id: "create", label: "Create snippet", icon: "Plus", run: () => { createSnippet(); ctx.settings.refresh(); } }],
    });

    // Renders the unified Settings surface (tree + dispatching panel + presenter).
    const surface = createWorkbenchSettingsModule({
      resolveScopeId: (scope) => (scope === "project" ? activeProjectId() : undefined),
    }).activate(ctx);

    // Settings is a modal overlay; closing it leaves the main region blank. A landing
    // widget gives a way back in by re-running the built-in open command.
    ctx.renderers.registerRenderer({
      id: "app.settings.launcher.renderer",
      render: (input) => (
        <button onClick={() => input.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID)}>
          Open settings
        </button>
      ),
    });
    ctx.layout.registerPanel({ id: "app.settings.launcher", title: "Settings", region: "main", rendererId: "app.settings.launcher.renderer" });
    ctx.layout.openPanel("app.settings.launcher");

    return surface;
  },
});`;
