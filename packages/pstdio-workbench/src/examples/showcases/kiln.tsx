import { createWorkbench } from "../../core";
import { KilnNav, KilnStatus } from "./kiln-chrome";
import { kilnObjects, kilnPage, kilnResource } from "./kiln-data";
import { KilnInspector } from "./kiln-inspector";
import { KilnTimeline } from "./kiln-timeline";
import { KilnViewport } from "./kiln-viewport";
import { kilnTheme } from "./themes";

const homePage = { ...kilnPage, id: "kiln" };

export const createKilnWorkbench = () => {
  const workbench = createWorkbench({
    startPage: homePage,
    initialSidePanelMode: "attached",
    defaultPanelOpenByRegionId: { secondary: true },
  });
  workbench.themes.register([kilnTheme]);
  workbench.modes.registerMode({
    id: "kiln",
    label: "Kiln",
    floatingPanels: "hidden",
    chrome: { nav: "kiln.nav", sidenav: false, activity: false, status: "kiln.status" },
    resourceKinds: ["kiln.object"],
    regionSettings: {
      side: { size: { defaultPx: 340, minPx: 300, maxPx: 440 }, collapsible: false },
      secondary: { size: { defaultPx: 188, minPx: 188, maxPx: 188 }, collapsible: false },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "kiln.nav",
    title: "Kiln project",
    body: { kind: "react", render: () => <KilnNav /> },
  });
  workbench.views.registerView({
    id: "kiln.viewport",
    title: "3D viewport",
    body: { kind: "react", render: (input) => <KilnViewport input={input} /> },
  });
  workbench.views.registerView({
    id: "kiln.inspector",
    title: "Scene and properties",
    body: { kind: "react", render: (input) => <KilnInspector input={input} /> },
  });
  workbench.views.registerView({
    id: "kiln.timeline",
    title: "Timeline",
    body: { kind: "react", render: (input) => <KilnTimeline workbench={input.workbench} /> },
  });
  workbench.views.registerView({
    id: "kiln.status",
    title: "Scene status",
    body: { kind: "react", render: (input) => <KilnStatus workbench={input.workbench} /> },
  });
  workbench.modePlacements.registerPlacement({
    id: "kiln.timeline",
    ref: { extensionId: "storybook.showcases", kind: "placement", id: "kiln.timeline" },
    modeId: "kiln",
    region: "secondary",
    item: { kind: "view", viewId: "kiln.timeline", presence: "fixed" },
  });
  workbench.pages.registerPage({
    id: "kiln.home",
    ref: homePage,
    title: "Clay Study",
    path: "kiln/clay-study",
    modeId: "kiln",
    slots: [{ id: "viewport", role: "primary", region: "main", viewId: "kiln.viewport" }],
  });
  workbench.pages.registerPage({
    id: "kiln.resource",
    ref: kilnPage,
    title: "Clay Study",
    path: "kiln/clay-study/resource",
    modeId: "kiln",
    parentId: "kiln.home",
    slots: [
      {
        id: "viewport",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["kiln.object"], viewId: "kiln.viewport", cardinality: "one" },
      },
      {
        id: "inspector",
        role: "auxiliary",
        region: "side",
        binding: { resourceKinds: ["kiln.object"], viewId: "kiln.inspector", cardinality: "one" },
        openOn: "page-resource",
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-kiln");
  workbench.pageLocations.navigate({ kind: "page", page: kilnPage, resource: kilnResource(kilnObjects[0]) });
  return workbench;
};
