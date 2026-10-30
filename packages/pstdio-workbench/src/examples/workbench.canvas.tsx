import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../core";
import { createStorybookArtifactsBridgeDocument } from "./artifacts-webview/bridge-document.storybook";
import { createArtifactsWebviewExampleModule } from "./artifacts-webview/module";
import artifactsWebviewSource from "./artifacts-webview/module.tsx?raw";
import { createFileRendererErrorStoryModule, createFileRendererStoryModule } from "./file-renderer/module";
import fileRendererSource from "./file-renderer/module.tsx?raw";
import { createHelloWorldModule } from "./hello-world/module";
import helloWorldSource from "./hello-world/module.tsx?raw";
import { createHostTerminalWorkbench } from "./host-terminal-story";
import hostTerminalSource from "./host-terminal-story.tsx?raw";
import { createKanbanRendererStoryModule } from "./kanban-renderer/module";
import kanbanRendererSource from "./kanban-renderer/module.tsx?raw";
import { createLayoutScopeExampleWorkbench } from "./layout-scope/module";
import layoutScopeSource from "./layout-scope/module.tsx?raw";
import { createPageCompositionWorkbench } from "./page-composition/module";
import pageCompositionSource from "./page-composition/module.tsx?raw";
import { createPreferenceSchemasExampleModule } from "./preferences/module";
import preferenceSchemasSource from "./preferences/module.tsx?raw";
import { createRegionMapModule } from "./region-map/module";
import regionMapSource from "./region-map/module.tsx?raw";
import { WorkbenchStory } from "./workbench-story";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Visual states",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Host API reference for @pstdio/workbench and @pstdio/workbench/react. These APIs build the application shell. Extension authors should use the separate Extension API reference.",
      },
    },
  },
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
  createArtifactsWebviewExampleModule({ createBridgeDocument: createStorybookArtifactsBridgeDocument }),
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
const referenceParameters = (description: string, code: string) => ({
  docs: {
    description: { story: description },
    source: { code, language: "tsx", type: "code" },
  },
});
export const PageComposition: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--page-composition",
  parameters: referenceParameters(
    "Pages declare the complete set of page-owned placements. Navigation replaces that set atomically.",
    pageCompositionSource,
  ),
  render: () => <WorkbenchStory workbench={pageCompositionWorkbench} />,
};
export const HelloWorld: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--hello-world",
  parameters: referenceParameters("The smallest complete View and placement registration.", helloWorldSource),
  render: () => <WorkbenchStory workbench={helloWorldWorkbench} />,
};
export const RegionMap: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--region-map",
  parameters: referenceParameters(
    "Every supported workbench placement region. This is an API map, not a suggested product layout.",
    regionMapSource,
  ),
  render: () => <WorkbenchStory workbench={regionMapWorkbench} />,
};
export const ArtifactsWebview: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--artifacts-webview",
  parameters: referenceParameters(
    "A webview with explicit bridge capabilities for commands and artifact access.",
    artifactsWebviewSource,
  ),
  render: () => <WorkbenchStory workbench={artifactsWebviewWorkbench} />,
};
export const KanbanRenderer: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--kanban-renderer",
  parameters: referenceParameters(
    "The built-in board renderer driven by an extension-owned schema, query, and mutations.",
    kanbanRendererSource,
  ),
  render: () => <WorkbenchStory workbench={kanbanRendererWorkbench} />,
};
export const FileRenderer: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--file-renderer",
  parameters: referenceParameters(
    "The native file renderer selects an editor or preview from the loaded MIME type.",
    fileRendererSource,
  ),
  render: () => <WorkbenchStory workbench={fileRendererWorkbench} />,
};
export const FileRendererLoadError: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--file-renderer-load-error",
  parameters: referenceParameters(
    "A file loader failure is contained in the panel and leaves the rest of the workbench usable.",
    fileRendererSource,
  ),
  render: () => <WorkbenchStory workbench={fileRendererErrorWorkbench} />,
};
export const LayoutScope: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--layout-scope",
  parameters: referenceParameters(
    "Layout scopes isolate user panel arrangements by project or workspace.",
    layoutScopeSource,
  ),
  render: () => <WorkbenchStory workbench={layoutScopeWorkbench} />,
};
export const PreferenceSchemas: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--preference-schemas",
  parameters: referenceParameters(
    "Typed preference schemas drive shared controls, defaults, validation, and scoped storage.",
    preferenceSchemasSource,
  ),
  render: () => <WorkbenchStory workbench={preferenceSchemasWorkbench} />,
};
export const HostTerminal: Story = {
  id: "pstdio-workbench-reference-core-api-visual-states--host-terminal",
  parameters: referenceParameters(
    "The host provides terminal process operations while the workbench owns the panel UI.",
    hostTerminalSource,
  ),
  render: () => <WorkbenchStory workbench={hostTerminalWorkbench} />,
};
