import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { createStorybookArtifactsBridgeDocument } from "../artifacts-webview/bridge-document.storybook";
import { createArtifactsWebviewExampleModule } from "../artifacts-webview/module";
import { createViewsWorkbench } from "../onboarding/core/views";
import reactSource from "../onboarding/core/views.tsx?raw";
import { createExtensionPreview } from "../onboarding/extension-preview";
import controlsExtension, { deploymentSettingsPage } from "../onboarding/extensions/controls-extension";
import controlsSource from "../onboarding/extensions/controls-extension.ts?raw";
import dataTableExtension, { servicesPage } from "../onboarding/extensions/data-table-extension";
import dataTableSource from "../onboarding/extensions/data-table-extension.ts?raw";
import fileExtension, { notesPage } from "../onboarding/extensions/file-extension";
import fileSource from "../onboarding/extensions/file-extension.ts?raw";
import kanbanExtension, { ticketsPage } from "../onboarding/extensions/kanban-extension";
import kanbanSource from "../onboarding/extensions/kanban-extension.ts?raw";
import treePageExtension, { guidePage } from "../onboarding/extensions/tree-page-extension";
import treeSource from "../onboarding/extensions/tree-page-extension.ts?raw";
import { OnboardingFrame } from "../onboarding/onboarding-frame";
import { onboardingSources } from "../onboarding/onboarding-sources";

const meta = {
  title: "pstdio-workbench/Guides/Renderers",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const rendererParameters = (description: string, code: string) => ({
  docs: {
    description: { story: description },
    source: { code, language: "tsx", type: "code" },
  },
});

const createWebviewWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule(
    createArtifactsWebviewExampleModule({ createBridgeDocument: createStorybookArtifactsBridgeDocument }),
  );
  return workbench;
};

export const ChooseRenderer: Story = {
  name: "0. Choose a renderer",
  parameters: rendererParameters(
    "Compare every supported View body before choosing one for a host feature or extension.",
    reactSource,
  ),
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};

export const ReactView: Story = {
  name: "1. React view",
  parameters: rendererParameters(
    "Trusted hosts can render React directly. Extensions cannot use this body kind.",
    reactSource,
  ),
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};

export const Tree: Story = {
  name: "2. Tree",
  parameters: rendererParameters(
    "The extension returns sections and nodes. The workbench owns tree interaction.",
    treeSource,
  ),
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(treePageExtension, guidePage.id)} />,
};

export const Controls: Story = {
  name: "3. Controls",
  parameters: rendererParameters(
    "The extension returns form declarations and values. The workbench renders and validates them.",
    controlsSource,
  ),
  render: () => (
    <OnboardingFrame createWorkbench={() => createExtensionPreview(controlsExtension, deploymentSettingsPage.id)} />
  ),
};

export const DataTable: Story = {
  name: "4. Data table",
  parameters: rendererParameters(
    "The extension returns columns and rows. The workbench owns table behavior.",
    dataTableSource,
  ),
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(dataTableExtension, servicesPage.id)} />,
};

export const Kanban: Story = {
  name: "5. Kanban",
  parameters: rendererParameters(
    "The extension returns attributes and rows. The workbench groups them into a board.",
    kanbanSource,
  ),
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(kanbanExtension, ticketsPage.id)} />,
};

export const File: Story = {
  name: "6. File",
  parameters: rendererParameters(
    "The extension loads content. The workbench picks the editor or preview from the file name.",
    fileSource,
  ),
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(fileExtension, notesPage.id)} />,
};

export const Webview: Story = {
  name: "7. Webview",
  parameters: rendererParameters(
    "A packaged UI runs in an isolated frame with declared host capabilities.",
    onboardingSources.webviewCapabilities,
  ),
  render: () => <OnboardingFrame createWorkbench={createWebviewWorkbench} />,
};
