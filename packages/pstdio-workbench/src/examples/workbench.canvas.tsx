import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../core";
import { createCanvasArtifactsBridgeDocument } from "./artifacts-webview/bridge-document.canvas-fixture";
import { createArtifactsWebviewExampleModule } from "./artifacts-webview/module";
import { createFileRendererErrorStoryModule, createFileRendererStoryModule } from "./file-renderer/module";
import { createHelloWorldModule } from "./hello-world/module";
import { createHostTerminalWorkbench } from "./host-terminal-story";
import { createKanbanRendererStoryModule } from "./kanban-renderer/module";
import { createLayoutScopeExampleWorkbench } from "./layout-scope/module";
import { createPageCompositionWorkbench } from "./page-composition/module";
import { createPreferenceSchemasExampleModule } from "./preferences/module";
import { createRegionMapModule } from "./region-map/module";
import { WorkbenchStory } from "./workbench-story";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Visual states",
  description:
    "Host API reference for @pstdio/workbench and @pstdio/workbench/react. These APIs build the application shell. Extension authors should use the separate Extension API reference.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const helloWorldWorkbench = createWorkbench();
helloWorldWorkbench.registerModule(createHelloWorldModule());
const pageCompositionWorkbench = createPageCompositionWorkbench();
const regionMapWorkbench = createWorkbench();
regionMapWorkbench.registerModule(createRegionMapModule());
const artifactsWebviewWorkbench = createWorkbench();
artifactsWebviewWorkbench.registerModule(
  createArtifactsWebviewExampleModule({ createBridgeDocument: createCanvasArtifactsBridgeDocument }),
);
const kanbanRendererWorkbench = createWorkbench();
kanbanRendererWorkbench.registerModule(createKanbanRendererStoryModule());
const fileRendererWorkbench = createWorkbench();
fileRendererWorkbench.registerModule(createFileRendererStoryModule());
const fileRendererErrorWorkbench = createWorkbench();
fileRendererErrorWorkbench.registerModule(createFileRendererErrorStoryModule());
const preferenceSchemasWorkbench = createWorkbench();
preferenceSchemasWorkbench.registerModule(createPreferenceSchemasExampleModule());
const layoutScopeWorkbench = createLayoutScopeExampleWorkbench();
const hostTerminalWorkbench = createHostTerminalWorkbench();
export const PageComposition: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--page-composition",
  description: "Pages declare the complete set of page-owned placements. Navigation replaces that set atomically.",
  render: () => <WorkbenchStory workbench={pageCompositionWorkbench} />,
};
export const HelloWorld: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--hello-world",
  description: "The smallest complete View and placement registration.",
  render: () => <WorkbenchStory workbench={helloWorldWorkbench} />,
};
export const RegionMap: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--region-map",
  description: "Every supported workbench placement region. This is an API map, not a suggested product layout.",
  render: () => <WorkbenchStory workbench={regionMapWorkbench} />,
};
export const ArtifactsWebview: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--artifacts-webview",
  description: "A webview with explicit bridge capabilities for commands and artifact access.",
  render: () => <WorkbenchStory workbench={artifactsWebviewWorkbench} />,
};
export const KanbanRenderer: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--kanban-renderer",
  description: "The built-in board renderer driven by an extension-owned schema, query, and mutations.",
  render: () => <WorkbenchStory workbench={kanbanRendererWorkbench} />,
};
export const FileRenderer: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--file-renderer",
  description: "The native file renderer selects an editor or preview from the loaded MIME type.",
  render: () => <WorkbenchStory workbench={fileRendererWorkbench} />,
};
export const FileRendererLoadError: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--file-renderer-load-error",
  description: "A file loader failure is contained in the panel and leaves the rest of the workbench usable.",
  render: () => <WorkbenchStory workbench={fileRendererErrorWorkbench} />,
};
export const LayoutScope: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--layout-scope",
  description: "Layout scopes isolate user panel arrangements by project or workspace.",
  render: () => <WorkbenchStory workbench={layoutScopeWorkbench} />,
};
export const PreferenceSchemas: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--preference-schemas",
  description: "Typed preference schemas drive shared controls, defaults, validation, and scoped storage.",
  render: () => <WorkbenchStory workbench={preferenceSchemasWorkbench} />,
};
export const HostTerminal: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--host-terminal",
  description: "The host provides terminal process operations while the workbench owns the panel UI.",
  render: () => <WorkbenchStory workbench={hostTerminalWorkbench} />,
};
