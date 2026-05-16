import { getThemePreferenceMode, Toaster, useThemePreference } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef } from "react";
import { createWorkbenchCore, type WorkbenchCore } from "../core";
import { Workbench } from "../react";
import { useWorkbenchStore } from "../react/shared/use-workbench-store";
import { createAreaMapModule } from "./area-map/module";
import { createConsumerExampleModule } from "./consumer/module";
import { createDashboardExampleModule } from "./dashboard/module";
import { createDynamicModulesWorkbench } from "./dynamic-modules/module";
import { createFoundationWorkbench } from "./foundation/module";
import { createHelloWorldModule } from "./hello-world/module";
import { createRandomExampleModule } from "./random/module";
import { createRendererTypesExampleModule } from "./renderer-types/module";
import { createWorkbenchModesExampleModule } from "./workbench-modes/module";

const meta = {
  title: "pstdio-workbench/Examples",
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

interface WorkbenchStoryProps {
  workbench: WorkbenchCore;
}

const WorkbenchStory = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const themeMode = getThemePreferenceMode(themePreference, themePreferences);
  const workbenchThemeId = useWorkbenchStore(workbench.theme.store, (state) => state.theme.id);
  const previousStoryThemeModeRef = useRef<string | undefined>(undefined);
  const previousWorkbenchThemeIdRef = useRef<string | undefined>(undefined);
  const workbenchThemeSubscriptionReadyRef = useRef(false);

  useEffect(() => {
    if (previousStoryThemeModeRef.current === themeMode) return;
    previousStoryThemeModeRef.current = themeMode;

    if (workbench.theme.getTheme().id === themeMode) return;
    workbench.theme.setTheme(themeMode);
  }, [themeMode, workbench]);

  useEffect(() => {
    if (!workbenchThemeSubscriptionReadyRef.current) {
      workbenchThemeSubscriptionReadyRef.current = true;
      previousWorkbenchThemeIdRef.current = workbenchThemeId;
      return;
    }

    if (previousWorkbenchThemeIdRef.current === workbenchThemeId) return;
    previousWorkbenchThemeIdRef.current = workbenchThemeId;

    if (workbenchThemeId !== "light" && workbenchThemeId !== "dark") return;

    const workbenchThemeMode = workbenchThemeId === "dark" ? "dark" : "light";
    if (workbenchThemeMode === themeMode) return;

    const nextPreference = themePreferences.find((preference) => preference.mode === workbenchThemeMode);
    if (nextPreference) setThemePreference(nextPreference.id);
  }, [setThemePreference, themeMode, themePreferences, workbenchThemeId]);

  return <Workbench workbench={workbench} />;
};

// Workbenches are constructed at module scope so their state (open panels, active
// mode, etc.) survives Storybook decorator remounts — notably the theme
// decorator, which keys the ThemePreferenceProvider by theme id and unmounts
// the story subtree on every theme switch.

const helloWorldWorkbench = createWorkbenchCore();
helloWorldWorkbench.registerModule(createHelloWorldModule());

const consumerWorkbench = createWorkbenchCore();
consumerWorkbench.registerModule(createConsumerExampleModule());

const workbenchModesWorkbench = createWorkbenchCore();
workbenchModesWorkbench.registerModule(createWorkbenchModesExampleModule());

const areaMapWorkbench = createWorkbenchCore();
areaMapWorkbench.registerModule(createAreaMapModule());

const dynamicModulesWorkbench = createDynamicModulesWorkbench();

const rendererTypesWorkbench = createWorkbenchCore();
rendererTypesWorkbench.registerModule(createRendererTypesExampleModule());

const dashboardWorkbench = createWorkbenchCore();
dashboardWorkbench.registerModule(createDashboardExampleModule());

const foundationWorkbench = createFoundationWorkbench();

const randomWorkbench = createWorkbenchCore();
randomWorkbench.registerModule(createRandomExampleModule());

export const HelloWorld: Story = {
  render: () => <WorkbenchStory workbench={helloWorldWorkbench} />,
};

export const ConsumerWorkbench: Story = {
  render: () => <WorkbenchStory workbench={consumerWorkbench} />,
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

export const FoundationConcepts: Story = {
  render: () => <WorkbenchStory workbench={foundationWorkbench} />,
};

export const Random: Story = {
  render: () => <WorkbenchStory workbench={randomWorkbench} />,
};
