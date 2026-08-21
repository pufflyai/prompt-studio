import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbenchCore } from "../core";
import { createDashboardWorkbench } from "./dashboard/module";
import { createDynamicModulesWorkbench } from "./dynamic-modules/module";
import { createExtensionThemesWorkbench } from "./extension-themes/module";
import { createFileRendererErrorStoryModule, createFileRendererStoryModule } from "./file-renderer/module";
import { createFoundationWorkbench } from "./foundation/module";
import { createHelloWorldModule } from "./hello-world/module";
import { createHistoryExampleModule } from "./history/module";
import { createHostTerminalWorkbench, createRestoredHostTerminalWorkbench } from "./host-terminal-story";
import { createKanbanRendererStoryModule } from "./kanban-renderer/module";
import { createKeepAliveExampleModule } from "./keep-alive/module";
import { createLayoutScopeExampleWorkbench } from "./layout-scope/module";
import { createModeChromeExampleModule } from "./mode-chrome/module";
import { createNavigationExampleModule } from "./navigation/module";
import { createPreferenceSchemasExampleModule } from "./preferences/module";
import { createPreviewTabsExampleModule } from "./preview-tabs/module";
import { createRandomExampleModule } from "./random/module";
import { createRegionMapModule } from "./region-map/module";
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

const modeChromeWorkbench = createWorkbenchCore();
modeChromeWorkbench.registerModule(createModeChromeExampleModule());

const workbenchModesWorkspaceWorkbench = createWorkbenchCore();
workbenchModesWorkspaceWorkbench.registerModule(createWorkbenchModesExampleModule("workspace"));

const workbenchModesSettingsWorkbench = createWorkbenchCore();
workbenchModesSettingsWorkbench.registerModule(createWorkbenchModesExampleModule("settings"));

const regionMapWorkbench = createWorkbenchCore();
regionMapWorkbench.registerModule(createRegionMapModule());

const surfaceAnchorsWorkbench = createWorkbenchCore();
surfaceAnchorsWorkbench.registerModule(createSurfaceAnchorsModule());

const dynamicModulesWorkbench = createDynamicModulesWorkbench();

const rendererTypesWorkbench = createWorkbenchCore();
rendererTypesWorkbench.registerModule(
  createRendererTypesExampleModule({ createBridgeDocument: createStorybookBridgeDocument }),
);

const dashboardWorkbench = createDashboardWorkbench({ canonicalGeometry: true });

const kanbanRendererWorkbench = createWorkbenchCore();
kanbanRendererWorkbench.registerModule(createKanbanRendererStoryModule());

const fileRendererWorkbench = createWorkbenchCore();
fileRendererWorkbench.registerModule(createFileRendererStoryModule());

const fileRendererErrorWorkbench = createWorkbenchCore();
fileRendererErrorWorkbench.registerModule(createFileRendererErrorStoryModule());

const foundationWorkbench = createFoundationWorkbench();

const randomWorkbench = createWorkbenchCore();
randomWorkbench.registerModule(createRandomExampleModule());

const keepAliveWorkbench = createWorkbenchCore({ initialSidePanelMode: "attached" });
keepAliveWorkbench.registerModule(createKeepAliveExampleModule());

const navigationWorkbench = createWorkbenchCore();
navigationWorkbench.registerModule(createNavigationExampleModule());

const historyWorkbench = createWorkbenchCore();
historyWorkbench.registerModule(createHistoryExampleModule());

const layoutScopeWorkbench = createLayoutScopeExampleWorkbench();

const preferenceSchemasWorkbench = createWorkbenchCore();
preferenceSchemasWorkbench.registerModule(createPreferenceSchemasExampleModule());

const previewTabsWorkbench = createWorkbenchCore({ initialSidePanelMode: "attached" });
previewTabsWorkbench.registerModule(createPreviewTabsExampleModule());

const extensionThemesWorkbench = createExtensionThemesWorkbench();
const treeNavigationWorkbench = createTreeNavigationWorkbench();
const hostTerminalWorkbench = createHostTerminalWorkbench();
const restoredHostTerminalWorkbench = createRestoredHostTerminalWorkbench();

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

export const ModeChrome: Story = {
  render: () => <WorkbenchStory workbench={modeChromeWorkbench} />,
};

export const WorkbenchModesWorkspace: Story = {
  render: () => <WorkbenchStory workbench={workbenchModesWorkspaceWorkbench} />,
};

export const WorkbenchModesSettings: Story = {
  render: () => <WorkbenchStory workbench={workbenchModesSettingsWorkbench} />,
};

export const RegionMap: Story = {
  render: () => <WorkbenchStory workbench={regionMapWorkbench} />,
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

export const KanbanRenderer: Story = {
  render: () => <WorkbenchStory workbench={kanbanRendererWorkbench} />,
};

// The file renderer dispatches by file type: markdown (notes.md) via the
// MarkdownEditor, code (example.ts) via Monaco, and a read-only image (logo.svg).
export const FileRenderer: Story = {
  render: () => <WorkbenchStory workbench={fileRendererWorkbench} />,
};

export const FileRendererLoadError: Story = {
  render: () => <WorkbenchStory workbench={fileRendererErrorWorkbench} />,
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

export const PreviewTabs: Story = {
  render: () => <WorkbenchStory workbench={previewTabsWorkbench} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sessionTab = await canvas.findByRole("tab", { name: "Session 42" });

    if (sessionTab.getAttribute("aria-selected") === "false") {
      await userEvent.click(sessionTab);
      await expect(sessionTab).toHaveAttribute("aria-selected", "true");
      await expect(sessionTab).toHaveAttribute("aria-expanded", "false");
    }

    await userEvent.click(sessionTab);
    const customMenu = await within(document.body).findByRole("menu", { name: "Session 42 menu" });
    await waitFor(() => expect(within(customMenu).getByRole("menuitem", { name: "New session" })).toBeVisible());
    await expect(within(customMenu).queryByRole("menuitem", { name: "Keep Open" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.pointer({ target: sessionTab, keys: "[MouseRight]" });
    const contextMenu = await within(document.body).findByRole("menu", { name: "Session 42 context menu" });
    await waitFor(() => expect(within(contextMenu).getByRole("menuitem", { name: "Keep Open" })).toBeVisible());
    await expect(within(contextMenu).queryByRole("menuitem", { name: "New session" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};

// The Theme Pack extension registers its color themes into `workbench.themes`;
// the workbench theme picker lists them only while the extension is enabled.
export const ExtensionThemes: Story = {
  render: () => <WorkbenchStory workbench={extensionThemesWorkbench} />,
};

// Type into the terminal to see the scripted echo; the panel resizes with the
// bottom region splitter.
export const HostTerminal: Story = {
  render: () => <WorkbenchStory workbench={hostTerminalWorkbench} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstTerminalTab = await canvas.findByRole("tab", { name: /Terminal 1/ });
    const secondTerminalTab = await canvas.findByRole("tab", { name: /Terminal 2/ });
    const notesTab = await canvas.findByRole("tab", { name: /notes\.md/ });
    const terminalTabsBefore = await canvas.findAllByRole("tab", { name: /Terminal \d+/ });
    const nextTerminalTitle = `Terminal ${terminalTabsBefore.length + 1}`;

    await userEvent.click(await canvas.findByRole("button", { name: "Add panel" }));

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

// A persisted hidden launcher is never shown as the selected Secondary Panel tab.
// The latest real tab is restored when the workbench enters the saved layout scope.
export const RestoredHostTerminal: Story = {
  render: () => <WorkbenchStory workbench={restoredHostTerminalWorkbench} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notesTab = await canvas.findByRole("tab", { name: /notes\.md/ });
    const terminalTab = await canvas.findByRole("tab", { name: /Terminal 1/ });

    await expect(notesTab).toHaveAttribute("aria-selected", "true");
    await expect(terminalTab).toHaveAttribute("aria-selected", "false");
    await expect(await canvas.findByText("build: ready")).toBeVisible();
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
