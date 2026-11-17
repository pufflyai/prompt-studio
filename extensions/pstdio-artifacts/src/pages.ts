import { definePage, defineView, l10n, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
import { artifactPage, libraryPageRef } from "./artifact-refs";
import { queryArtifactTitle } from "./artifact-title";
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
    capabilities: [
      "commands.execute",
      "files.download",
      "resources.actions.register",
      "commands.query",
      "preferences.get",
      "preferences.set",
      "navigation.open",
    ],
  },
});
export const library = definePage({
  id: libraryPageRef.id,
  title: l10n("pages.artifacts", "Artifacts"),
  path: libraryPageRef.id,
  icon: "file-code",
  mode: workbenchModes.project,
  main: { kind: "view", presentation: "page", view: view.ref, cardinality: "one" },
  slots: [],
});
export const detail = definePage({
  id: artifactPage.id,
  title: l10n("pages.artifact", "Artifact"),
  path: artifactPage.path,
  mode: workbenchModes.project,
  parent: library.ref,
  resource: { kinds: [artifact.ref] },
  main: {
    kind: "view",
    presentation: "page",
    view: view.ref,
    cardinality: "one",
    tab: { query: queryArtifactTitle, refreshEvents: [changedEvent] },
  },
  slots: [],
});
