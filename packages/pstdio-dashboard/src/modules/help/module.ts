import type { TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { readRuntimeConfig } from "@/lib/api";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";

const GITHUB_DOCS_URL = "https://github.com/pufflyai/prompt-studio";
const DISCORD_URL = "https://discord.gg/3RxwUEk8fW";

export const getDashboardVersion = () => {
  const runtimeVersion = readRuntimeConfig()?.version?.trim();
  if (runtimeVersion) return runtimeVersion;

  const buildVersion = import.meta.env?.VITE_APP_VERSION?.trim();
  return buildVersion && buildVersion.length > 0 ? buildVersion : "dev";
};

export const getDashboardVersionLabel = (version = getDashboardVersion()) => `v${version}`;

export const openDashboardHelpLink = (
  url: string,
  open: (url: string, target: string, features: string) => unknown,
) => {
  open(url, "_blank", "noopener,noreferrer");
};

const openHelpLink = (url: string) => {
  openDashboardHelpLink(url, window.open.bind(window));
};

const helpFooterNode = (): TreeNode => ({
  id: "help",
  label: "Help",
  icon: "CircleHelp",
  canHide: true,
  menuPath: dashboardHelpMenuPath,
  menuPlacement: "top-start",
});

const registerHelpSidenav = (ctx: WorkbenchModuleContext) =>
  registerSidenavContribution(ctx, {
    id: "dashboard.help.footer",
    modes: ["*"],
    order: 10,
    region: "footer",
    getFooterNodes: () => [helpFooterNode()],
  });

export const createHelpModule = () =>
  ({
    id: "dashboard.help",
    activate(ctx) {
      registerHelpSidenav(ctx);
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openDocs, label: "Documentation", category: "Help", icon: "BookOpen" },
        { execute: () => openHelpLink(GITHUB_DOCS_URL) },
      );
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openDiscord, label: "Discord", category: "Help", icon: "MessageCircle" },
        { execute: () => openHelpLink(DISCORD_URL) },
      );
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.productInfo,
          label: "Prompt Studio",
          category: "Help",
          description: getDashboardVersionLabel(),
        },
        { execute: () => undefined, isEnabled: () => false },
      );

      ctx.layout.registerMenuItem(dashboardHelpMenuPath, {
        commandId: dashboardCommandIds.openDocs,
        order: 20,
        external: true,
      });
      ctx.layout.registerMenuItem(dashboardHelpMenuPath, {
        commandId: dashboardCommandIds.openDiscord,
        order: 30,
        external: true,
      });
      ctx.layout.registerMenuItem(dashboardHelpMenuPath, {
        commandId: dashboardCommandIds.productInfo,
        label: "Prompt Studio",
        description: getDashboardVersionLabel(),
        iconSrc: "/logo.svg",
        readOnly: true,
        order: 40,
      });
    },
  }) satisfies WorkbenchModuleContribution;
