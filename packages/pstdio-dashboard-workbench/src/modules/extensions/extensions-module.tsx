import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/services/workbench/ids";
import { openSurfaceWidget } from "@/services/workbench/module-helpers";
import { dashboardResourceKindIds } from "@/services/workbench/resources/resource-kinds";
import { ExtensionRoute } from "./renderers/extension-route";

// Extensions surface: extension routes resolve through workbench resources and
// open in a `main` widget tab, one per route path.
export const createExtensionsModule = (): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.extensions",
  activate(ctx) {
    ctx.resources.registerKind({
      kind: dashboardResourceKindIds.extensionRoute,
      label: "Extension",
      icon: "Blocks",
    });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.extensionRoute,
      render: (input) => <ExtensionRoute input={input} />,
    });

    ctx.layout.registerWidget({
      id: dashboardWidgetIds.extensionRoute,
      title: "Extension",
      area: "main",
      closable: true,
      rendererId: dashboardWidgetIds.extensionRoute,
      resourceKinds: [dashboardResourceKindIds.extensionRoute],
    });

    ctx.resources.registerOpener({
      id: "pstdio-dashboard-workbench.extensions.opener",
      canOpen: (resource) => resource.kind === dashboardResourceKindIds.extensionRoute,
      open: (resource, input) => openSurfaceWidget(ctx, dashboardWidgetIds.extensionRoute, resource, input),
    });
  },
});
