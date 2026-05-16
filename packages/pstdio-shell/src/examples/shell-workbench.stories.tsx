import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { createShellCore } from "../core";
import { ShellWorkbench } from "../react";
import { createAreaMapModule } from "./area-map/module";
import { createConsumerExampleModule } from "./consumer/module";
import { createDashboardExampleModule } from "./dashboard/module";
import { createDynamicModulesShell } from "./dynamic-modules/module";
import { createHelloWorldModule } from "./hello-world/module";
import { createRandomExampleModule } from "./random/module";
import { createRendererTypesExampleModule } from "./renderer-types/module";
import { createWorkbenchModesExampleModule } from "./workbench-modes/module";

const meta = {
  title: "pstdio-shell/Examples",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Shells are constructed at module scope so their state (open panels, active
// mode, etc.) survives Storybook decorator remounts — notably the theme
// decorator, which keys the ThemePreferenceProvider by theme id and unmounts
// the story subtree on every theme switch.

const helloWorldShell = createShellCore();
helloWorldShell.registerModule(createHelloWorldModule());

const consumerShell = createShellCore();
consumerShell.registerModule(createConsumerExampleModule());

const workbenchModesShell = createShellCore();
workbenchModesShell.registerModule(createWorkbenchModesExampleModule());

const areaMapShell = createShellCore();
areaMapShell.registerModule(createAreaMapModule());

const dynamicModulesShell = createDynamicModulesShell();

const rendererTypesShell = createShellCore();
rendererTypesShell.registerModule(createRendererTypesExampleModule());

const dashboardShell = createShellCore();
dashboardShell.registerModule(createDashboardExampleModule());

const randomShell = createShellCore();
randomShell.registerModule(createRandomExampleModule());

export const HelloWorld: Story = {
  render: () => <ShellWorkbench shell={helloWorldShell} />,
};

export const ConsumerWorkbench: Story = {
  render: () => <ShellWorkbench shell={consumerShell} />,
};

export const WorkbenchModes: Story = {
  render: () => <ShellWorkbench shell={workbenchModesShell} />,
};

export const AreaMap: Story = {
  render: () => <ShellWorkbench shell={areaMapShell} />,
};

export const DynamicModules: Story = {
  render: () => <ShellWorkbench shell={dynamicModulesShell} />,
};

export const RendererTypes: Story = {
  render: () => <ShellWorkbench shell={rendererTypesShell} />,
};

export const DashboardShell: Story = {
  render: () => <ShellWorkbench shell={dashboardShell} />,
};

export const Random: Story = {
  render: () => <ShellWorkbench shell={randomShell} />,
};
