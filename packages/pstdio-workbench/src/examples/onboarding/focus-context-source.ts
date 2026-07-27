export const focusContextSource = `import {
  workbenchCommandPaletteMenuPath,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";

const MARK_SELECTED_COMMAND_ID = "docs.mark-selected";
const SELECTED_KIND_CONTEXT_KEY = "docs.selectedKind";

export const createFocusContextModule = (): WorkbenchModuleContribution => ({
  id: "docs.focus-context",
  activate(ctx) {
    ctx.layout.registerPanel({
      id: "docs.focus-context.main",
      title: "Focus and context",
      region: "main",
      singleton: true,
      rendererId: "docs.focus-context.renderer",
    });

    ctx.layout.registerPanel({
      id: "docs.focus-context.panel",
      title: "Context",
      region: "secondary",
      rendererId: "docs.focus-context.renderer",
    });

    ctx.renderers.registerRenderer({
      id: "docs.focus-context.renderer",
      render: ({ workbench }) => (
        <section>
          <button onClick={() => workbench.focus.setActiveRegion("main")}>
            Focus main
          </button>
          <button onClick={() => workbench.focus.setActiveRegion("secondary")}>
            Focus panel
          </button>
          <button onClick={() => ctx.context.set(SELECTED_KIND_CONTEXT_KEY, "guide")}>
            Select guide
          </button>
        </section>
      ),
    });

    ctx.commands.registerCommand(
      {
        id: MARK_SELECTED_COMMAND_ID,
        label: "Mark selected guide",
        category: "Docs",
        when: "docs.selectedKind == guide && mainFocus",
      },
      {
        execute: () => ctx.notifications.show({ level: "success", title: "Selected guide marked" }),
      },
    );

    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: MARK_SELECTED_COMMAND_ID,
      group: "Docs",
    });

    ctx.layout.openPanel("docs.focus-context.main");
    ctx.layout.openPanel("docs.focus-context.panel");
    ctx.focus.setActiveRegion("main");
  },
});`;
