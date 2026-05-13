import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createShellCore } from "../core";
import { ShellWorkbench } from "../react";
import { AreaMapShellExample } from "./area-map-shell-example";
import { createConsumerShellExample } from "./consumer-shell-example";
import { commandPaletteMenuPath } from "./consumer-shell-example-data";
import { DashboardShellExample } from "./dashboard-shell-example";
import { RandomShellExample } from "./random-shell-example";
import { WorkbenchModesShellExample } from "./workbench-modes-shell-example";

const meta = {
  title: "pstdio-shell/Examples",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const ConsumerWorkbenchStory = (props: { initialWidgetId?: string; initialCommandPaletteOpen?: boolean }) => {
  const { initialCommandPaletteOpen, initialWidgetId } = props;
  const [example] = useState(() => createConsumerShellExample({ initialWidgetId }));

  return (
    <ShellWorkbench
      shell={example.shell}
      commandPaletteMenuPath={commandPaletteMenuPath}
      initialCommandPaletteOpen={initialCommandPaletteOpen}
      initialSessionPanelMode="attached"
    />
  );
};

const MinimalWorkbenchStory = () => {
  const [shell] = useState(createShellCore);

  return <ShellWorkbench shell={shell} />;
};

export const ConsumerWorkbench: Story = {
  render: () => <ConsumerWorkbenchStory />,
};

export const WorkbenchModes: Story = {
  render: () => <WorkbenchModesShellExample />,
};

export const AreaMap: Story = {
  render: () => <AreaMapShellExample />,
};

export const DashboardShell: Story = {
  render: () => <DashboardShellExample />,
};

export const Random: Story = {
  render: () => <RandomShellExample />,
};

export const MinimalWorkbench: Story = {
  render: () => <MinimalWorkbenchStory />,
};
