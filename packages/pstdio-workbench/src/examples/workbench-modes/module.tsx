import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../core";
import { WorkbenchModesActivityBar } from "./components/activity-bar";
import { activityBarWidgetId, workbenchModes } from "./mock-data/data";
import { registerProjectMode } from "./modules/project-mode";
import { registerSettingsMode } from "./modules/settings-mode";
import { registerWorkspaceMode } from "./modules/workspace-mode";

// Registration is module-scoped; each mode re-opens the activity bar in its
// activate, since resetAreas() clears all placements on mode switch.
const registerActivityBar = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: activityBarWidgetId,
    title: "Mode switcher",
    area: "activityBar",
    singleton: true,
    rendererId: activityBarWidgetId,
  });
  ctx.renderers.registerRenderer({
    id: activityBarWidgetId,
    render: (input) => <WorkbenchModesActivityBar input={input} />,
  });
};

export const createWorkbenchModesExampleModule = (): WorkbenchModuleContribution => ({
  id: "workbench-modes-example",
  activate(ctx) {
    registerActivityBar(ctx);
    registerProjectMode(ctx);
    registerWorkspaceMode(ctx);
    registerSettingsMode(ctx);
    ctx.modes.setActiveMode(workbenchModes.project.id);
  },
});
