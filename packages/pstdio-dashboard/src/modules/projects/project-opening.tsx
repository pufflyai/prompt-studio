import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectOpeningWidget } from "./components/project-opening-widget";

export const registerProjectOpening = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectOpening,
    title: "Opening project",
    body: { kind: "react", render: (input) => <ProjectOpeningWidget input={input} /> },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.projectOpening,
    viewId: dashboardWidgetIds.projectOpening,
    closable: false,
    config: { size: "md", placement: "center", closeOnInteractOutside: false },
  });
};
