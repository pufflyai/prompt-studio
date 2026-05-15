import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { createShellCore } from "../core";
import { ShellWorkbench } from "../react";
import { activateAreaMapExample } from "./area-map/module";
import { activateConsumerExample } from "./consumer/module";
import { activateDashboardExample } from "./dashboard/example";
import { activateRandomExample } from "./random/example";
import { activateWorkbenchModesExample } from "./workbench-modes/module";

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

export const ConsumerWorkbench: Story = {
  render: () => {
    const shell = createShellCore();
    activateConsumerExample(shell);
    return <ShellWorkbench shell={shell} />;
  },
};

export const WorkbenchModes: Story = {
  render: () => {
    const shell = createShellCore();
    activateWorkbenchModesExample(shell);
    return <ShellWorkbench shell={shell} />;
  },
};

export const AreaMap: Story = {
  render: () => {
    const shell = createShellCore();
    activateAreaMapExample(shell);
    return <ShellWorkbench shell={shell} />;
  },
};

export const DashboardShell: Story = {
  render: () => {
    const shell = createShellCore();
    activateDashboardExample(shell);
    return <ShellWorkbench shell={shell} />;
  },
};

export const Random: Story = {
  render: () => {
    const shell = createShellCore();
    activateRandomExample(shell);
    return <ShellWorkbench shell={shell} />;
  },
};

export const MinimalWorkbench: Story = {
  render: () => {
    const shell = createShellCore();

    shell.layout.registerWidget({
      id: "minimal.welcome",
      title: "Welcome",
      area: "main",
      renderer: "react",
      rendererId: "minimal.welcome",
    });

    shell.layout.registerWidget({
      id: "minimal.welcome2",
      title: "Welcom2",
      area: "main",
      renderer: "react",
      rendererId: "minimal.welcome2",
    });

    shell.renderers.registerRenderer({
      id: "minimal.welcome",
      render: () => (
        <div style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>Minimal workbench</h1>
          <p>A single widget rendered into the main area.</p>
        </div>
      ),
    });

    shell.renderers.registerRenderer({
      id: "minimal.welcome2",
      render: () => (
        <div style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>Minimal workbench</h1>
          <p>A single widget rendered into the main area.</p>
        </div>
      ),
    });

    shell.layout.openWidget("minimal.welcome2");
    shell.layout.openWidget("minimal.welcome");

    return <ShellWorkbench shell={shell} />;
  },
};
