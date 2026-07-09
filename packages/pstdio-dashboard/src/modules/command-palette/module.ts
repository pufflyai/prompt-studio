import type { WorkbenchModuleContribution } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";

export const createCommandPaletteModule = () =>
  ({
    id: "dashboard.command-palette",
    activate(ctx) {
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openCommandPalette, label: "Search", category: "Workbench", icon: "Search" },
        { execute: () => ctx.commandPalette.open() },
      );
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openFile, label: "Open file", category: "Dashboard", icon: "FileText" },
        {
          execute: (args) => {
            const { path } = args as { path: string };
            ctx.notifications.show({ level: "info", title: `Opened ${path}` });
          },
        },
      );
    },
  }) satisfies WorkbenchModuleContribution;
