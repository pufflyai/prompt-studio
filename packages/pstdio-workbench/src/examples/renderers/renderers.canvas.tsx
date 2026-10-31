import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { createCanvasArtifactsBridgeDocument } from "../artifacts-webview/bridge-document.canvas-fixture";
import { createArtifactsWebviewExampleModule } from "../artifacts-webview/module";
import { createViewsWorkbench } from "../onboarding/core/views";
import { createExtensionPreview } from "../onboarding/extension-preview";
import controlsExtension, { deploymentSettingsPage } from "../onboarding/extensions/controls-extension";
import dataTableExtension, { servicesPage } from "../onboarding/extensions/data-table-extension";
import fileExtension, { notesPage } from "../onboarding/extensions/file-extension";
import kanbanExtension, { ticketsPage } from "../onboarding/extensions/kanban-extension";
import treePageExtension, { guidePage } from "../onboarding/extensions/tree-page-extension";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Guides/Renderers",
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
const createWebviewWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule(
    createArtifactsWebviewExampleModule({ createBridgeDocument: createCanvasArtifactsBridgeDocument }),
  );
  return workbench;
};
export const ChooseRenderer: Story = {
  id: "pstdio-workbench-guides-renderers--choose-renderer",
  name: "0. Choose a renderer",
  description: "Compare every supported View body before choosing one for a host feature or extension.",
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
export const ReactView: Story = {
  id: "pstdio-workbench-guides-renderers--react-view",
  name: "1. React view",
  description: "Trusted hosts can render React directly. Extensions cannot use this body kind.",
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
export const Tree: Story = {
  id: "pstdio-workbench-guides-renderers--tree",
  name: "2. Tree",
  description: "The extension returns sections and nodes. The workbench owns tree interaction.",
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(treePageExtension, guidePage.id)} />,
};
export const Controls: Story = {
  id: "pstdio-workbench-guides-renderers--controls",
  name: "3. Controls",
  description: "The extension returns form declarations and values. The workbench renders and validates them.",
  render: () => (
    <OnboardingFrame createWorkbench={() => createExtensionPreview(controlsExtension, deploymentSettingsPage.id)} />
  ),
};
export const DataTable: Story = {
  id: "pstdio-workbench-guides-renderers--data-table",
  name: "4. Data table",
  description: "The extension returns columns and rows. The workbench owns table behavior.",
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(dataTableExtension, servicesPage.id)} />,
};
export const Kanban: Story = {
  id: "pstdio-workbench-guides-renderers--kanban",
  name: "5. Kanban",
  description: "The extension returns attributes and rows. The workbench groups them into a board.",
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(kanbanExtension, ticketsPage.id)} />,
};
export const File: Story = {
  id: "pstdio-workbench-guides-renderers--file",
  name: "6. File",
  description: "The extension loads content. The workbench picks the editor or preview from the file name.",
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(fileExtension, notesPage.id)} />,
};
export const Webview: Story = {
  id: "pstdio-workbench-guides-renderers--webview",
  name: "7. Webview",
  description: "A packaged UI runs in an isolated frame with declared host capabilities.",
  render: () => <OnboardingFrame createWorkbench={createWebviewWorkbench} />,
};
