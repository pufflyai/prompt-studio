import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchCore } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { createHelpModule, getDashboardVersionLabel, openDashboardHelpLink } from "./module";

const createHelpWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createHelpModule());
  return workbench;
};

const resolveMenuCommandIds = (workbench: WorkbenchCore) =>
  workbench.layout.listMenuItems(dashboardHelpMenuPath).map((item) => item.commandId);

describe("dashboard help module", () => {
  test("matches the dashboard sidebar help menu actions", () => {
    const workbench = createHelpWorkbench();

    expect(resolveMenuCommandIds(workbench)).toEqual([
      dashboardCommandIds.openDocs,
      dashboardCommandIds.openDiscord,
      dashboardCommandIds.productInfo,
    ]);
    expect(workbench.commands.getCommand(dashboardCommandIds.openDocs)?.command.icon).toBe("BookOpen");
    expect(workbench.commands.getCommand(dashboardCommandIds.openDiscord)?.command.icon).toBe("MessageCircle");
    expect(workbench.commands.getCommand(dashboardCommandIds.productInfo)?.command.label).toBe("Prompt Studio");
  });

  test("renders Prompt Studio as read-only product metadata", () => {
    const workbench = createHelpWorkbench();

    expect(workbench.layout.listMenuItems(dashboardHelpMenuPath).at(-1)).toMatchObject({
      commandId: dashboardCommandIds.productInfo,
      label: "Prompt Studio",
      description: getDashboardVersionLabel(),
      iconSrc: "/logo.svg",
      readOnly: true,
    });
    expect(workbench.commands.isCommandEnabled(dashboardCommandIds.productInfo)).toBe(false);
  });

  test("opens external help links like the dashboard sidebar", () => {
    const open = mock();

    openDashboardHelpLink("https://example.com/docs", open);

    expect(open).toHaveBeenCalledWith("https://example.com/docs", "_blank", "noopener,noreferrer");
  });

  test("formats the dashboard version subtitle", () => {
    expect(getDashboardVersionLabel("1.2.3")).toBe("v1.2.3");
  });
});
