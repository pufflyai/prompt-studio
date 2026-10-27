import {
  definePage,
  defineView,
  packageAsset,
  qualifyRef,
  serializePageUrl,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { canvasResource } from "./resource";

export { canvasResource } from "./resource";
export const canvasView = defineView({
  id: "canvas",
  title: "UI Canvas",
  body: {
    kind: "webview",
    entry: packageAsset("./view/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "clipboard.write", "navigation.open"],
  },
});
export const homePage = definePage({
  id: "canvases",
  title: "UI Canvas",
  path: "canvases",
  mode: workbenchModes.project,
  main: { kind: "view", view: canvasView.ref, cardinality: "one" },
  slots: [],
});
export const canvasPage = definePage({
  id: "canvas",
  title: "UI Canvas",
  path: "canvases/design",
  mode: workbenchModes.project,
  resource: { kinds: [canvasResource.ref] },
  parent: homePage.ref,
  main: { kind: "view", view: canvasView.ref, cardinality: "many" },
  slots: [],
});
export const canvasTarget = (id: string, label: string) => ({
  kind: "page" as const,
  page: canvasPage.ref,
  resource: { type: canvasResource.id, id, label },
});
export const canvasUrl = (projectId: string, id: string) =>
  serializePageUrl({
    projectId,
    page: { ...canvasPage, ref: qualifyRef("pstdio.canvas", canvasPage.ref) },
    resource: { type: canvasResource.id, id, projectId, extensionId: "pstdio.canvas" },
  });
