import type { WorkbenchModuleContext, WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardExtensionsPage } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { ExtensionsPanel } from "./components/extensions-panel";

const ExtensionsPage = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  return <ExtensionsPanel key={projectId} projectId={projectId} settingsInput={input} />;
};

export const registerExtensionsPage = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.extensions,
    title: "Extensions",
    body: {
      kind: "react",
      render: (input) => <ExtensionsPage input={input} />,
    },
  });
  ctx.pages.registerPage({
    id: "extensions",
    ref: dashboardExtensionsPage,
    title: "Extensions",
    icon: "Puzzle",
    path: "extensions",
    modeId: "project",
    main: {
      kind: "view",
      cardinality: "one",
      presentation: "page",
      view: { kind: "view", id: dashboardWidgetIds.extensions },
    },
    slots: [],
  });
  ctx.keybindings.registerKeybinding({
    action: { kind: "page", page: dashboardExtensionsPage },
    keybinding: "Mod+Shift+X",
    label: "Open extensions",
  });
  ctx.keybindings.registerKeybinding({
    action: { kind: "page", page: dashboardExtensionsPage },
    keybinding: "E",
    layer: "go",
    label: "Go to extensions",
  });
  const sections = [
    {
      ...dashboardNavigationSections.footer,
      nodes: [
        {
          id: "extensions",
          label: "Extensions",
          icon: "Puzzle",
          canHide: true,
          target: { kind: "page" as const, page: dashboardExtensionsPage },
        },
      ],
    },
  ];
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.extensions.footer",
    modes: ["project"],
    slot: "footer",
    getStructure: () => sections,
    getSections: () => sections,
  });
};
