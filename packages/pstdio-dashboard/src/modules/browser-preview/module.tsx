import {
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  type WorkbenchPanelInstance,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import i18n from "@/i18n";
import { buildAbsoluteApiUrl } from "@/lib/api";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { BrowserPreviewPanel } from "./browser-preview-panel";
import { browserPreviewResourceKind, createBrowserPreviewResource } from "./browser-preview-resource";
import { type BrowserPreviewUrlPolicy, normalizeBrowserPreviewUrl } from "./browser-preview-url";
import { type BrowserPreviewViewport, normalizeBrowserPreviewViewport } from "./browser-preview-viewport";

interface OpenBrowserPreviewArgs {
  url?: string;
  viewport?: BrowserPreviewViewport;
}

const getUrlPolicy = (): BrowserPreviewUrlPolicy => ({
  dashboardOrigin: globalThis.location?.origin,
  apiOrigin: new URL(buildAbsoluteApiUrl("")).origin,
});

const openBrowserPreview = (ctx: WorkbenchModuleContext, args: OpenBrowserPreviewArgs | undefined) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) throw new Error(i18n.t("browserPreview.errors.projectRequired"));

  const normalizedUrl = args?.url ? normalizeBrowserPreviewUrl(args.url, getUrlPolicy()) : undefined;
  if (normalizedUrl && !normalizedUrl.ok) {
    throw new Error(i18n.t(`browserPreview.errors.${normalizedUrl.reason}`));
  }

  const resource = createBrowserPreviewResource({
    projectId,
    url: normalizedUrl?.ok ? normalizedUrl.url : undefined,
    viewport: normalizeBrowserPreviewViewport(args?.viewport),
  });

  return ctx.layout.openPanel(dashboardWidgetIds.browserPreview, {
    resource,
    title: normalizedUrl?.ok ? new URL(normalizedUrl.url).host : i18n.t("browserPreview.panelTitle"),
    strategy: { kind: "persistent", position: "end" },
  });
};

export const createBrowserPreviewModule = () =>
  ({
    id: "dashboard.browser-preview",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: browserPreviewResourceKind,
        label: i18n.t("browserPreview.title"),
        icon: "PanelTop",
      });
      ctx.layout.registerSubPanel(
        {
          id: dashboardWidgetIds.browserPreview,
          title: i18n.t("browserPreview.panelTitle"),
          icon: "PanelTop",
          region: "main",
          singleton: false,
          reuse: "none",
          closable: true,
          mountStrategy: "keep-mounted",
          resourceKinds: [browserPreviewResourceKind],
          rendererId: dashboardWidgetIds.browserPreview,
          openCommandId: dashboardCommandIds.openBrowserPreview,
          priority: 60,
        },
        { priority: 60 },
      );
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.browserPreview,
        render: (input) => <BrowserPreviewPanel input={input} />,
      });
      ctx.commands.registerCommand<OpenBrowserPreviewArgs | undefined, WorkbenchPanelInstance>(
        {
          id: dashboardCommandIds.openBrowserPreview,
          label: i18n.t("browserPreview.commandLabel"),
          category: i18n.t("browserPreview.category"),
          icon: "PanelTop",
          params: {
            url: { type: "string", label: i18n.t("browserPreview.urlLabel"), required: false },
          },
        },
        { execute: (args) => openBrowserPreview(ctx, args) },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openBrowserPreview,
        order: 45,
      });
    },
  }) satisfies WorkbenchModuleContribution;
