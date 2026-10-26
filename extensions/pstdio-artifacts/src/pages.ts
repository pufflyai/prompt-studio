import { definePage, definePlacement, defineView, l10n, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
import {
  artifactPage,
  artifactPanelRef,
  artifactViewRef,
  libraryPageRef,
  libraryPanelRef,
  libraryViewRef,
} from "./artifact-refs";
import { queryArtifactTab } from "./artifact-tab";
import { changedEvent } from "./events";
import { artifact } from "./resource-kinds";

export { artifact } from "./resource-kinds";

export const view = defineView({
  id: "artifacts",
  title: l10n("views.artifacts", "Artifacts"),
  icon: "file-code",
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open", "placement.close"],
  },
});
export const libraryPanel = definePlacement({
  id: libraryViewRef.id,
  mode: workbenchModes.project,
  region: "main",
  addableIn: ["main"],
  replaces: [libraryPanelRef],
  order: 0,
  mountStrategy: "keep-mounted",
  item: { kind: "view", view: view.ref, presence: "closed" },
});
export const artifactPanel = definePlacement({
  id: artifactViewRef.id,
  mode: workbenchModes.project,
  region: "main",
  replaces: [artifactPanelRef],
  order: 1,
  mountStrategy: "keep-mounted",
  tab: { query: queryArtifactTab, refreshEvents: [changedEvent] },
  item: { kind: "binding", binding: { kinds: [artifact.ref], view: view.ref, cardinality: "many" } },
});
export const library = definePage({
  id: libraryPageRef.id,
  title: l10n("pages.artifacts", "Artifacts"),
  path: libraryPageRef.id,
  icon: "file-code",
  mode: workbenchModes.project,
  main: { kind: "panels", landing: libraryPanel.ref },
  panelView: libraryPanel.ref,
  slots: [],
});
export const detail = definePage({
  id: artifactPage.id,
  title: l10n("pages.artifact", "Artifact"),
  path: artifactPage.path,
  mode: workbenchModes.project,
  parent: library.ref,
  resource: { kinds: [artifact.ref] },
  main: { kind: "panels", landing: artifactPanel.ref },
  slots: [],
});
