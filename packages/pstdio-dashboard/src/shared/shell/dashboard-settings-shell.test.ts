import { describe, expect, it } from "bun:test";
import {
  createDashboardSettingsShell,
  GLOBAL_SETTINGS_AGENTS_RESOURCE,
  GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID,
  GLOBAL_SETTINGS_RESOURCE_KIND,
  GLOBAL_SETTINGS_TREE_ID,
  GLOBAL_SETTINGS_WIDGET_ID,
} from "./dashboard-settings-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

describe("createDashboardSettingsShell", () => {
  it("registers the global settings shell slice and opens agents settings", async () => {
    const navigations: string[] = [];
    const shell = createDashboardSettingsShell({
      navigate: (path) => navigations.push(path),
    });

    expect(shell.resources.getKind(GLOBAL_SETTINGS_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.trees.getTreeView(GLOBAL_SETTINGS_TREE_ID)).toMatchObject({
      area: "left",
      areaSize: { defaultPx: 320, minPx: 200 },
      defaultExpandedSectionIds: ["settings"],
      icon: "Settings",
    });
    expect(shell.layout.getWidget(GLOBAL_SETTINGS_WIDGET_ID)).toMatchObject({
      area: "main",
      renderer: "react",
    });
    expect(shell.commands.getCommand(GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID)?.command.label).toBe("Agent settings");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toEqual([
      GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID,
    ]);

    await shell.resources.openResource(GLOBAL_SETTINGS_AGENTS_RESOURCE);
    const sections = await shell.trees.getSections(GLOBAL_SETTINGS_TREE_ID);

    expect(navigations).toEqual(["/settings?panel=agents"]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(GLOBAL_SETTINGS_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://settings/agents");
    expect(
      sections.flatMap((section) => section.nodes).some((node) => node.resource?.uri === "pstdio://settings/agents"),
    ).toBeTrue();
    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);

    shell.dispose();

    expect(shell.commands.getCommand(GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID)).toBeUndefined();
  });
});
