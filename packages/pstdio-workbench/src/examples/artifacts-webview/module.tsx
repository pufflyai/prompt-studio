import type { WorkbenchModuleContribution } from "../../core";
import {
  createWorkbenchWebviewHostCapabilities,
  getBridgeWebviewHostEventPublisher,
  renderBridgeWebviewFrame,
} from "../../extensions";
import type { ArtifactsBridgeDocumentAssets } from "./bridge-document";
import { artifactsWebviewCapabilities } from "./bridge-document";

export interface CreateArtifactsWebviewExampleModuleInput {
  createBridgeDocument: () => ArtifactsBridgeDocumentAssets;
}

const panelId = "artifacts-webview.panel";

// A 12x8 bar-chart png, standing in for the short-lived signed URL the API mints.
const chartImageUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAANklEQVR4nGN49OIDQcQAZ1k3fUOWQOaiK4LLIXMZ0PhwEqciZDlkBgOyNJocHDGg8bEiohQBALyizkc72HIbAAAAAElFTkSuQmCC";

const artifactFiles = [
  { path: "a/chart.png", size: 512, mediaType: "image/png" },
  { path: "a/summary.json", size: 64, mediaType: "application/json" },
];

const summaryText = JSON.stringify({ score: 0.98, verdict: "pass" }, null, 2);

// In-memory stand-in for the API-backed implementation. The capability gate in
// front of it is the real one: calls for mounts outside the declared
// `artifacts.read:runs` grant never reach this function.
const readArtifacts = async (params: unknown) => {
  const request = params as { op: string; mount: string; path?: string; prefix?: string };
  if (request.mount !== "runs") throw new Error(`Artifact mount not found: ${request.mount}`);
  if (request.op === "list") return artifactFiles.filter((file) => file.path.startsWith(request.prefix ?? ""));
  if (request.op === "readText") return summaryText;
  if (request.op === "imageUrl") return chartImageUrl;
  throw new Error("Unsupported artifacts.read operation.");
};

export const createArtifactsWebviewExampleModule = (
  input: CreateArtifactsWebviewExampleModuleInput,
): WorkbenchModuleContribution => ({
  id: "artifacts-webview",
  activate(ctx) {
    const bridgeDocument = input.createBridgeDocument();
    ctx.views.registerView({
      id: panelId,
      title: "Run report",
      body: {
        kind: "react",
        render: ({ workbench, instance }) =>
          renderBridgeWebviewFrame({
            context: {
              workbench,
              webviewId: panelId,
              placement: instance,
              hostEvents: getBridgeWebviewHostEventPublisher(workbench, instance),
            },
            createHostCapabilities: (context) => ({
              ...createWorkbenchWebviewHostCapabilities(context),
              "artifacts.read": readArtifacts,
            }),
            createProps: ({ placement }) => ({ placement, resource: placement.resource }),
            ownerId: "workbench",
            title: "Run report",
            webview: {
              capabilities: [...artifactsWebviewCapabilities],
              moduleUrl: bridgeDocument.moduleUrl,
              runtimeUrl: bridgeDocument.runtimeUrl,
            },
          }),
      },
    });
    ctx.overlays.registerOverlay({
      id: panelId,
      viewId: panelId,
    });
    ctx.overlays.openOverlay(panelId);

    return { dispose: () => bridgeDocument.dispose() };
  },
});
