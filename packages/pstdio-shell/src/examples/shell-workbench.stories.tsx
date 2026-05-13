import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createShellCore } from "../core";
import { ShellWorkbench } from "../react";
import { AreaMapShellExample } from "./area-map-shell-example";
import { createConsumerShellExample } from "./consumer-shell-example";
import { commandPaletteMenuPath } from "./consumer-shell-example-data";
import { DashboardShellExample } from "./dashboard-shell-example";
import { MultiLeftPanelShellExample } from "./multi-left-panel-shell-example";
import { SignalRoomShellExample } from "./signal-room-shell-example";

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
      renderers={example.renderers}
      commandPaletteMenuPath={commandPaletteMenuPath}
      initialCommandPaletteOpen={initialCommandPaletteOpen}
      initialSessionPanelMode="attached"
      leftTreeViewId="project.navigation"
      leftFooterTreeViewId="project.navigation.footer"
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

export const MultiLeftPanelWorkbench: Story = {
  render: () => <MultiLeftPanelShellExample />,
};

export const AreaMap: Story = {
  render: () => <AreaMapShellExample />,
};

export const DashboardShell: Story = {
  render: () => <DashboardShellExample />,
};

export const SignalRoom: Story = {
  render: () => <SignalRoomShellExample />,
};

export const MinimalWorkbench: Story = {
  render: () => <MinimalWorkbenchStory />,
};
