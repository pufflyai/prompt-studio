import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbenchCore } from "../core";
import { createAreaMapModule } from "./area-map/module";
import { createDashboardWorkbench } from "./dashboard/module";
import { createDataRendererStoryModule } from "./data-renderer/module";
import { createDynamicModulesWorkbench } from "./dynamic-modules/module";
import { createExtensionThemesWorkbench } from "./extension-themes/module";
import { createFoundationWorkbench } from "./foundation/module";
import { createHelloWorldModule } from "./hello-world/module";
import { createHistoryExampleModule } from "./history/module";
import { createKeepAliveExampleModule } from "./keep-alive/module";
import { createLayoutScopeExampleWorkbench } from "./layout-scope/module";
import { createNavigationExampleModule } from "./navigation/module";
import { createPreferenceSchemasExampleModule } from "./preferences/module";
import { createRandomExampleModule } from "./random/module";
import { createStorybookBridgeDocument } from "./renderer-types/bridge-document.storybook";
import { createRendererTypesExampleModule } from "./renderer-types/module";
import { createViewsFavoritesWorkbench } from "./views-favorites/module";
import { createWorkbenchModesExampleModule } from "./workbench-modes/module";
import { WorkbenchStory } from "./workbench-story";

// Chrome (sizing box, Toaster viewport) and theming live in WorkbenchStory so
// the workbench owns its own theme provider — no story-level theme decorator.
const meta = {
  title: "pstdio-workbench/Examples",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Workbenches are constructed at module scope so their state (open panels, active
// mode, etc.) survives Storybook decorator remounts — notably the theme
// decorator, which keys WorkbenchThemeProvider by theme id and unmounts the
// story subtree on every theme switch.

const helloWorldWorkbench = createWorkbenchCore();
helloWorldWorkbench.registerModule(createHelloWorldModule());

const workbenchModesWorkbench = createWorkbenchCore();
workbenchModesWorkbench.registerModule(createWorkbenchModesExampleModule());

const areaMapWorkbench = createWorkbenchCore();
areaMapWorkbench.registerModule(createAreaMapModule());

const dynamicModulesWorkbench = createDynamicModulesWorkbench();

const rendererTypesWorkbench = createWorkbenchCore();
rendererTypesWorkbench.registerModule(
  createRendererTypesExampleModule({ createBridgeDocument: createStorybookBridgeDocument }),
);

const dashboardWorkbench = createDashboardWorkbench();

const dataRendererWorkbench = createWorkbenchCore();
dataRendererWorkbench.registerModule(createDataRendererStoryModule());

const viewsFavoritesWorkbench = createViewsFavoritesWorkbench();

const foundationWorkbench = createFoundationWorkbench();

const randomWorkbench = createWorkbenchCore();
randomWorkbench.registerModule(createRandomExampleModule());

const keepAliveWorkbench = createWorkbenchCore({ initialSessionPanelMode: "attached" });
keepAliveWorkbench.registerModule(createKeepAliveExampleModule());

const navigationWorkbench = createWorkbenchCore();
navigationWorkbench.registerModule(createNavigationExampleModule());

const historyWorkbench = createWorkbenchCore();
historyWorkbench.registerModule(createHistoryExampleModule());

const layoutScopeWorkbench = createLayoutScopeExampleWorkbench();

const preferenceSchemasWorkbench = createWorkbenchCore();
preferenceSchemasWorkbench.registerModule(createPreferenceSchemasExampleModule());

const extensionThemesWorkbench = createExtensionThemesWorkbench();

export const HelloWorld: Story = {
  render: () => <WorkbenchStory workbench={helloWorldWorkbench} />,
};

export const WorkbenchModes: Story = {
  render: () => <WorkbenchStory workbench={workbenchModesWorkbench} />,
};

export const AreaMap: Story = {
  render: () => <WorkbenchStory workbench={areaMapWorkbench} />,
};

export const DynamicModules: Story = {
  render: () => <WorkbenchStory workbench={dynamicModulesWorkbench} />,
};

export const RendererTypes: Story = {
  render: () => <WorkbenchStory workbench={rendererTypesWorkbench} />,
};

export const DashboardWorkbench: Story = {
  render: () => <WorkbenchStory workbench={dashboardWorkbench} />,
};

export const DataRenderer: Story = {
  render: () => <WorkbenchStory workbench={dataRendererWorkbench} />,
};

export const ViewsAndFavorites: Story = {
  render: () => <WorkbenchStory workbench={viewsFavoritesWorkbench} />,
};

export const FoundationConcepts: Story = {
  render: () => <WorkbenchStory workbench={foundationWorkbench} />,
};

export const Random: Story = {
  render: () => <WorkbenchStory workbench={randomWorkbench} />,
};

export const KeepAlive: Story = {
  render: () => <WorkbenchStory workbench={keepAliveWorkbench} />,
};

export const Navigation: Story = {
  render: () => <WorkbenchStory workbench={navigationWorkbench} />,
};

export const History: Story = {
  render: () => <WorkbenchStory workbench={historyWorkbench} />,
};

export const LayoutScope: Story = {
  render: () => <WorkbenchStory workbench={layoutScopeWorkbench} />,
};

export const PreferenceSchemas: Story = {
  render: () => <WorkbenchStory workbench={preferenceSchemasWorkbench} />,
};

// The Theme Pack extension registers its color themes into `workbench.themes`;
// the workbench theme picker lists them only while the extension is enabled.
export const ExtensionThemes: Story = {
  render: () => <WorkbenchStory workbench={extensionThemesWorkbench} />,
};
