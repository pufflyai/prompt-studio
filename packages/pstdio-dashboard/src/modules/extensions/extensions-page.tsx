import type { ListProjectExtensionsResponse } from "@pstdio/sdk/api";
import type { WorkbenchModuleContext, WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { getDashboardQueryClient } from "@/lib/query-client";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardExtensionDetailPage, dashboardExtensionsPage } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { projectExtensionsQueryKey } from "@/shared/extensions/project-extension-cache";
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
  ctx.resources.registerKind({
    kind: "extension",
    extensionId: "pstdio",
    label: "Extension",
    icon: "tool-case",
    resolve: (resource) => {
      const projectId = ctx.context.get(dashboardSelectedProjectIdContextKey);
      if (typeof projectId !== "string") return resource;
      const data = getDashboardQueryClient().getQueryData<ListProjectExtensionsResponse>(
        projectExtensionsQueryKey(projectId),
      );
      const installed = data?.extensions.find((entry) => resource.id === `installed:${entry.id}`);
      const available = data?.marketplace.find((entry) => resource.id === `marketplace:${entry.installName}`);
      const extension = installed ?? available;
      return extension ? { ...resource, label: extension.displayName } : resource;
    },
    subscribe: (listener) => getDashboardQueryClient().getQueryCache().subscribe(listener),
  });
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
    icon: "tool-case",
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
  ctx.pages.registerPage({
    id: "extension-detail",
    ref: dashboardExtensionDetailPage,
    title: "Extension",
    path: "extensions/detail",
    parentId: "extensions",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "pstdio", id: "extension" }] },
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
    keybinding: "Alt+Shift+O",
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
          icon: "tool-case",
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
