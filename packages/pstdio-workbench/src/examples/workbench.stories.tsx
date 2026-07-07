import { Box, Text } from "@chakra-ui/react";
import { createScriptedTerminalBridge } from "@pstdio/ui/terminal";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbenchCore } from "../core";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "../react/terminal/terminal-module";
import { createAreaMapModule } from "./area-map/module";
import { createDashboardWorkbench } from "./dashboard/module";
import { createDataRendererStoryModule } from "./data-renderer/module";
import { createDynamicModulesWorkbench } from "./dynamic-modules/module";
import { createExtensionThemesWorkbench } from "./extension-themes/module";
import { createFileRendererStoryModule } from "./file-renderer/module";
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
import { createSurfaceAnchorsModule } from "./surface-anchors/module";
import { createTreeNavigationWorkbench } from "./tree-navigation/module";
import { createWorkbenchModesExampleModule } from "./workbench-modes/module";
import { WorkbenchStory } from "./workbench-story";

// Story chrome and theming live in WorkbenchStory so the workbench owns its own
// theme provider — no story-level theme decorator.
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

const surfaceAnchorsWorkbench = createWorkbenchCore();
surfaceAnchorsWorkbench.registerModule(createSurfaceAnchorsModule());

const dynamicModulesWorkbench = createDynamicModulesWorkbench();

const rendererTypesWorkbench = createWorkbenchCore();
rendererTypesWorkbench.registerModule(
  createRendererTypesExampleModule({ createBridgeDocument: createStorybookBridgeDocument }),
);

const dashboardWorkbench = createDashboardWorkbench();

const dataRendererWorkbench = createWorkbenchCore();
dataRendererWorkbench.registerModule(createDataRendererStoryModule());

const fileRendererWorkbench = createWorkbenchCore();
fileRendererWorkbench.registerModule(createFileRendererStoryModule());

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
const treeNavigationWorkbench = createTreeNavigationWorkbench();
const hostTerminalNotesWidgetId = "host-terminal-story.notes";
const hostTerminalNotesRendererId = "host-terminal-story.notes.renderer";

// Host-owned terminal surface driven by a deterministic scripted bridge — the
// panel chrome comes from the workbench `secondary` area, the session registry
// from `workbench.terminal`.
const hostTerminalWorkbench = createWorkbenchCore();
hostTerminalWorkbench.registerModule({
  id: "host-terminal-story",
  activate(ctx) {
    const scriptedTerminal = createScriptedTerminalBridge({
      initial: [{ data: "workbench host terminal (scripted)\r\n$ " }],
    });
    ctx.terminal.setSessionOpener((request) => scriptedTerminal.openSession(request));
    const terminalDisposables = createWorkbenchTerminalModule().activate(ctx);
    const notesWidget = ctx.layout.registerWidget({
      id: hostTerminalNotesWidgetId,
      title: "notes.md",
      area: "secondary",
      singleton: false,
      closable: true,
      rendererId: hostTerminalNotesRendererId,
    });
    const notesRenderer = ctx.renderers.registerRenderer({
      id: hostTerminalNotesRendererId,
      render: () => (
        <Box h="full" w="full" p="md" bg="bg" color="fg">
          <Text textStyle="label/S/medium">notes.md</Text>
          <Text mt="sm" textStyle="paragraph/S/regular" color="fg.muted">
            build: ready
            <br />
            owner: workbench
          </Text>
        </Box>
      ),
    });
    openWorkbenchTerminal(ctx);
    openWorkbenchTerminal(ctx);
    ctx.layout.openWidget(hostTerminalNotesWidgetId, { title: "notes.md" });
    return [
      ...(Array.isArray(terminalDisposables) ? terminalDisposables : terminalDisposables ? [terminalDisposables] : []),
      notesWidget,
      notesRenderer,
    ];
  },
});

const findOption = async (canvasElement: HTMLElement, name: string) => {
  const canvas = within(canvasElement);
  const options = await canvas.findAllByRole("option", { name });
  const option = options[0];
  if (!option) throw new Error(`Expected option: ${name}`);
  return option;
};

const expectSelectedOption = async (canvasElement: HTMLElement, name: string) => {
  await expect(await findOption(canvasElement, name)).toHaveAttribute("aria-selected", "true");
};

const expectUnselectedOption = async (canvasElement: HTMLElement, name: string) => {
  await expect(await findOption(canvasElement, name)).toHaveAttribute("aria-selected", "false");
};

export const HelloWorld: Story = {
  render: () => <WorkbenchStory workbench={helloWorldWorkbench} />,
};

export const WorkbenchModes: Story = {
  render: () => <WorkbenchStory workbench={workbenchModesWorkbench} />,
};

export const AreaMap: Story = {
  render: () => <WorkbenchStory workbench={areaMapWorkbench} />,
};

// Demonstrates the resource-projected surface model: primary anchor + projections, the
// derived (secondary) and detached (floating) anchors, scoped candidates, surface routing,
// and primary-vs-global. Switch workspaces to watch terminals re-scope and a session
// disconnect when it leaves scope.
export const SurfaceAnchors: Story = {
  render: () => <WorkbenchStory workbench={surfaceAnchorsWorkbench} />,
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

// The file renderer dispatches by file type: markdown (notes.md) via the
// MarkdownEditor, code (example.ts) via Monaco, and a read-only image (logo.svg).
export const FileRenderer: Story = {
  render: () => <WorkbenchStory workbench={fileRendererWorkbench} />,
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

// Type into the terminal to see the scripted echo; the panel resizes with the
// bottom area splitter.
export const HostTerminal: Story = {
  render: () => <WorkbenchStory workbench={hostTerminalWorkbench} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstTerminalTab = await canvas.findByRole("tab", { name: /Terminal 1/ });
    const secondTerminalTab = await canvas.findByRole("tab", { name: /Terminal 2/ });
    const notesTab = await canvas.findByRole("tab", { name: /notes\.md/ });
    const terminalTabsBefore = await canvas.findAllByRole("tab", { name: /Terminal \d+/ });
    const nextTerminalTitle = `Terminal ${terminalTabsBefore.length + 1}`;

    await userEvent.click(await canvas.findByRole("button", { name: "New terminal" }));

    const newTerminalTab = await canvas.findByRole("tab", { name: new RegExp(nextTerminalTitle) });
    await expect(newTerminalTab).toHaveAttribute("aria-selected", "true");

    await userEvent.click(firstTerminalTab);
    await expect(firstTerminalTab).toHaveAttribute("aria-selected", "true");
    await expect(await canvas.findByText("workbench host terminal (scripted)")).toBeVisible();

    await userEvent.click(notesTab);
    await expect(notesTab).toHaveAttribute("aria-selected", "true");

    await userEvent.click(firstTerminalTab);
    await expect(firstTerminalTab).toHaveAttribute("aria-selected", "true");
    await expect(await canvas.findByText("workbench host terminal (scripted)")).toBeVisible();

    await userEvent.click(secondTerminalTab);
    await expect(secondTerminalTab).toHaveAttribute("aria-selected", "true");
  },
};

export const TreeNavigation: Story = {
  render: () => <WorkbenchStory workbench={treeNavigationWorkbench} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await findOption(canvasElement, "Tickets"));
    await expectSelectedOption(canvasElement, "Tickets");

    await userEvent.click(await canvas.findByRole("button", { name: "Open ticket" }));
    await expectSelectedOption(canvasElement, "Tickets");

    await userEvent.click(await findOption(canvasElement, "Workspaces"));
    await expectSelectedOption(canvasElement, "Workspaces");

    await userEvent.click(await canvas.findByRole("button", { name: "Return to ticket" }));
    await expectSelectedOption(canvasElement, "Tickets");
    await expectUnselectedOption(canvasElement, "Workspaces");

    await userEvent.click(await findOption(canvasElement, "Settings"));
    await expectSelectedOption(canvasElement, "Settings");

    await userEvent.click(await within(document.body).findByLabelText("Close Settings"));
    await expectSelectedOption(canvasElement, "Tickets");
    await expectUnselectedOption(canvasElement, "Settings");
  },
};
