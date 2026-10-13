import { Text } from "@chakra-ui/react";
import { createWindowingFixture } from "./fixture";

export const createPanelControlsFixture = (
  edges: { side?: "left"; sidenav?: "right" } = {},
  statusChrome: boolean | "hidden" = false,
) => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    registerMode: (workbench) => {
      workbench.modes.registerMode({
        id: "windowing",
        label: "Windowing",
        chrome: {
          sidenav: "windowing.workspaces",
          ...(statusChrome ? { status: statusChrome === "hidden" ? false : "windowing.status" } : {}),
        },
        activate() {},
      });
      if (statusChrome)
        workbench.views.registerView({
          id: "windowing.status",
          title: "Mode status",
          body: {
            kind: "react",
            render: () => (
              <Text px="sm" textStyle="label/XS">
                Mode status
              </Text>
            ),
          },
        });
      if (statusChrome === "hidden")
        workbench.statusBar.registerItem({ id: "hidden.status", viewId: "windowing.status", slot: "trailing" });
    },
  });
  const layout = fixture.workbench.layout.getLayout();
  fixture.workbench.layout.restoreLayout({
    ...layout,
    regions: {
      ...layout.regions,
      side: { ...layout.regions.side, edge: edges.side },
      sidenav: { ...layout.regions.sidenav, edge: edges.sidenav },
    },
  });
  fixture.workbench.shell.setRegionOpen("side", true);
  return fixture;
};
