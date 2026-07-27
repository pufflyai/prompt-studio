import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "../../core";
import { createWorkbenchTerminalModule } from "../../react/terminal/terminal-module";
import { WorkbenchModesActivityBar } from "./components/activity-bar";
import { activityBarWidgetId, type WorkbenchModeId, workbenchModes } from "./mock-data/data";
import { registerProjectMode } from "./modules/project-mode";
import { registerSettingsMode } from "./modules/settings-mode";
import { registerWorkspaceMode } from "./modules/workspace-mode";

const registerActivityBar = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    closable: false,
    id: activityBarWidgetId,
    title: "Mode switcher",
    region: "activity",
    singleton: true,
    rendererId: activityBarWidgetId,
  });
  ctx.renderers.registerRenderer({
    id: activityBarWidgetId,
    render: (input) => <WorkbenchModesActivityBar input={input} />,
  });
};

export const createWorkbenchModesExampleModule = (
  initialMode: WorkbenchModeId = workbenchModes.project.id,
): WorkbenchModuleContribution => ({
  id: "workbench-modes-example",
  activate(ctx) {
    // The example drives the host-owned terminal surface with a deterministic
    // scripted backend — no real shells in stories.
    const scriptedTerminal = createScriptedTerminalBridge({
      initial: [{ data: "pstdio workspace terminal (scripted)\r\n$ " }],
    });
    ctx.terminal.setSessionOpener((request) => scriptedTerminal.openSession(request));
    const terminalSurface = createWorkbenchTerminalModule().activate(ctx);

    registerActivityBar(ctx);
    registerProjectMode(ctx);
    registerWorkspaceMode(ctx);
    registerSettingsMode(ctx);
    ctx.modes.setActiveMode(initialMode);
    return terminalSurface;
  },
});
