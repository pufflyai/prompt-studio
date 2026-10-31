import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { PageRef } from "@pstdio/sdk/extensions";
import {
  createWorkbench,
  type WorkbenchPageSlot,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPanelWorkbench = (
  options: {
    alwaysShowTabs?: boolean;
    multiple?: boolean;
    actions?: boolean;
    closable?: boolean;
    resource?: boolean;
    menu?: boolean;
    menusOnly?: boolean;
    cardinality?: "one" | "many";
    resourceLabel?: string;
    tabLabel?: string;
  } = {},
) => {
  const page: PageRef = { extensionId: "preview", kind: "page", id: "panel-tabs" };
  const workbench = createWorkbench({
    startPage: page,
    initialSidePanelMode: "attached",
    defaultPanelOpenByRegionId: { secondary: true },
    regionSettings: Object.fromEntries(
      workbenchPanelRegions.map((region) => [region, { alwaysShowTabs: options.alwaysShowTabs }]),
    ),
  });
  workbench.modes.registerMode({ id: "panel-tabs", label: "Panel tabs", activate: () => undefined });
  for (const region of workbenchPanelRegions) {
    for (const suffix of ["first", "second"]) {
      const id = `${region}.${suffix}`;
      workbench.views.registerView({
        id,
        title: `${region} ${suffix}`,
        body: {
          kind: "react",
          render: () => (
            <Box p="md">
              <Text>{id} content</Text>
            </Box>
          ),
        },
      });
    }
    if (options.actions) {
      const id = `${region}.refresh`;
      workbench.commands.registerCommand(
        { id, label: `Refresh ${region}`, icon: "refresh-cw" },
        { execute: () => undefined },
      );
      workbench.layout.registerMenuItem(workbenchRegionTabLeadingMenuPath(region), { commandId: id });
    }
  }
  if (options.menu) {
    workbench.viewMenus.registerViewMenu({
      id: "inspector",
      ownerViewId: "main.first",
      viewId: "main.second",
      side: "right",
    });
  }
  const slots: WorkbenchPageSlot[] = workbenchPanelRegions.flatMap((region) => [
    ...(region === "main" || options.menusOnly
      ? []
      : [
          {
            id: `${region}.first`,
            region,
            item: {
              kind: "view" as const,
              view: { kind: "view" as const, id: `${region}.first` },
              presence: options.closable ? ("open" as const) : ("fixed" as const),
            },
          },
        ]),
    ...(options.multiple
      ? [
          {
            id: `${region}.second`,
            region,
            item: {
              kind: "view" as const,
              view: { kind: "view" as const, id: `${region}.second` },
              presence: "open" as const,
            },
          },
        ]
      : []),
  ]);
  workbench.pages.registerPage({
    id: "panel-tabs",
    ref: page,
    title: "Panel tabs",
    path: "panel-tabs",
    modeId: "panel-tabs",
    main: { kind: "view", view: { kind: "view", id: "main.first" }, cardinality: "one" },
    slots,
  });
  const resourcePage = { ...page, id: "document" };
  workbench.pages.registerPage({
    id: "document",
    ref: resourcePage,
    title: "Document",
    path: "document",
    modeId: "panel-tabs",
    parentId: "panel-tabs",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: "main.first" },
      cardinality: options.cardinality ?? "one",
      ...(options.tabLabel ? { tab: { getSnapshot: () => ({ label: options.tabLabel }) } } : {}),
    },
    slots,
  });
  workbench.pageLocations.switchProject("preview-panel-tabs");
  if (options.menusOnly) {
    for (const region of ["secondary", "side"] as const) {
      const id = `${region}.menu`;
      workbench.layout.registerPanelMenu({
        id,
        title: `${region} menu`,
        region: `${region}-right-menu`,
        rendererId: `${region}.second`,
        regionCollapsible: false,
      });
      workbench.layout.openWidget(id);
    }
  }
  if (options.resource) {
    workbench.pageLocations.navigate({
      kind: "page",
      page: resourcePage,
      resource: { type: "document", id: "one", label: options.resourceLabel },
    });
  }
  return workbench;
};
const createUnavailableMenuWorkbench = () => {
  const workbench = createPanelWorkbench();
  workbench.modes.registerMode({ id: "main-only", label: "Main only", panels: ["main"], activate: () => undefined });
  workbench.layout.registerPlaceholder({
    id: "unavailable-menu",
    title: "Unavailable menu",
    region: "side-right-menu",
    rendererId: "side.second",
    regionCollapsible: false,
  });
  workbench.modes.setActiveMode("main-only");
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel tabs",
  component: WorkbenchStory,
  description:
    "Single-resource Main pages have no tab. Pages supporting many resources and optional panels keep their last tab and Close button. alwaysShowTabs overrides the single-tab default. Header actions remain available without tabs.",
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SingleItems: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--single-items",
  args: { workbench: createPanelWorkbench() },
};
export const MenuOnlyPanels: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--menu-only-panels",
  args: { workbench: createPanelWorkbench({ menusOnly: true }) },
};
export const UnavailableMenuPanel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--unavailable-menu-panel",
  args: { workbench: createUnavailableMenuWorkbench() },
};
export const AlwaysShowTabs: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--always-show-tabs",
  args: { workbench: createPanelWorkbench({ alwaysShowTabs: true }) },
};
export const SingleResourcePage: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--single-resource-page",
  args: { workbench: createPanelWorkbench({ resource: true }) },
};
export const SingleResourceWithMenu: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--single-resource-with-menu",
  args: { workbench: createPanelWorkbench({ resource: true, menu: true }) },
};
export const CloseResourcePage: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--close-resource-page",
  args: { workbench: createPanelWorkbench({ resource: true, cardinality: "many" }) },
};
export const SingleClosablePanel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--single-closable-panel",
  args: { workbench: createPanelWorkbench({ closable: true }) },
};
export const HiddenSingleTabs: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--hidden-single-tabs",
  args: { workbench: createPanelWorkbench({ closable: true, alwaysShowTabs: false }) },
};
export const ResourceTabLabel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--resource-tab-label",
  args: { workbench: createPanelWorkbench({ resource: true, resourceLabel: "Design notes", cardinality: "many" }) },
};
export const ExplicitTabLabel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--explicit-tab-label",
  args: {
    workbench: createPanelWorkbench({
      resource: true,
      cardinality: "many",
      resourceLabel: "Design notes",
      tabLabel: "Unsaved notes",
      alwaysShowTabs: true,
    }),
  },
};
export const AlwaysShowClosablePanel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--always-show-closable-panel",
  args: { workbench: createPanelWorkbench({ closable: true, alwaysShowTabs: true }) },
};
export const MultipleItems: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--multiple-items",
  args: { workbench: createPanelWorkbench({ multiple: true, closable: true }) },
};
export const ActionsWithoutTabs: Story = {
  id: "pstdio-workbench-reference-core-api-panel-tabs--actions-without-tabs",
  args: { workbench: createPanelWorkbench({ actions: true }) },
};
