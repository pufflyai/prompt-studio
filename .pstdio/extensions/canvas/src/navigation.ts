import {
  definePage,
  definePlacement,
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
  icon: canvasResource.icon,
  body: {
    kind: "webview",
    entry: packageAsset("./view/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "clipboard.write", "navigation.open"],
  },
});
export const canvasPanel = definePlacement({
  id: "canvas-tabs",
  mode: workbenchModes.project,
  region: "main",
  mountStrategy: "keep-mounted",
  item: { kind: "binding", binding: { kinds: [canvasResource.ref], view: canvasView.ref, cardinality: "many" } },
});
export const homePage = definePage({
  id: "canvases",
  title: "UI Canvas",
  icon: canvasResource.icon,
  path: "canvases",
  mode: workbenchModes.project,
  main: { kind: "panels" },
  slots: [],
});
export const canvasPage = definePage({
  id: "canvas",
  title: "UI Canvas",
  icon: canvasResource.icon,
  path: "canvases/design",
  mode: workbenchModes.project,
  resource: { kinds: [canvasResource.ref] },
  parent: homePage.ref,
  main: { kind: "panels", landing: canvasPanel.ref },
  slots: [],
});
export const canvasTarget = (id: string, label: string, projectId?: string) => ({
  kind: "page" as const,
  page: canvasPage.ref,
  open: "preview" as const,
  resource: {
    type: canvasResource.id,
    id,
    label,
    icon: canvasResource.icon,
    ...(projectId ? { projectId, extensionId: "pstdio.canvas" } : {}),
  },
});
export const canvasUrl = (projectId: string, id: string) =>
  serializePageUrl({
    projectId,
    page: { ...canvasPage, ref: qualifyRef("pstdio.canvas", canvasPage.ref) },
    resource: { type: canvasResource.id, id, projectId, extensionId: "pstdio.canvas" },
  });
