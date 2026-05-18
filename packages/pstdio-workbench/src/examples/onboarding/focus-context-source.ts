export const focusContextSource = `import {
  workbenchCommandPaletteMenuPath,
  type WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const MARK_SELECTED_COMMAND_ID = "docs.mark-selected";
const SELECTED_KIND_CONTEXT_KEY = "docs.selectedKind";

export const createFocusContextModule = (): WorkbenchModuleContribution => ({
  id: "docs.focus-context",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: "docs.focus-context.main",
      title: "Focus and context",
      area: "main",
      singleton: true,
      rendererId: "docs.focus-context.renderer",
    });

    ctx.layout.registerWidget({
      id: "docs.focus-context.panel",
      title: "Context",
      area: "main-bottom",
      rendererId: "docs.focus-context.renderer",
    });

    ctx.renderers.registerRenderer({
      id: "docs.focus-context.renderer",
      render: ({ workbench }) => (
        <section>
          <button onClick={() => workbench.commands.executeCommand("workbench.focusMain")}>
            Focus main
          </button>
          <button onClick={() => workbench.commands.executeCommand("workbench.focusPanel")}>
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

    ctx.layout.openWidget("docs.focus-context.main");
    ctx.layout.openWidget("docs.focus-context.panel");
    ctx.focus.setActiveArea("main");
  },
});`;
