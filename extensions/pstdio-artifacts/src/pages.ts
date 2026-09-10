import { definePage, defineResourceKind, defineView, l10n, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";

export const artifact = defineResourceKind({
  id: "artifact",
  label: l10n("resources.artifact", "Artifact"),
  icon: "file-code",
});
export const view = defineView({
  id: "artifacts",
  title: l10n("views.artifacts", "Artifacts"),
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open", "placement.close"],
  },
});
export const library = definePage({
  id: "artifacts",
  title: l10n("pages.artifacts", "Artifacts"),
  path: "artifacts",
  icon: "file-code",
  mode: workbenchModes.project,
  main: { kind: "panels", empty: view.ref },
  slots: [
    {
      id: "library",
      region: "main",
      order: 0,
      mountStrategy: "keep-mounted",
      item: { kind: "view", view: view.ref, presence: "fixed" },
    },
    {
      id: "artifact",
      region: "main",
      order: 1,
      mountStrategy: "keep-mounted",
      item: {
        kind: "binding",
        binding: { kinds: [artifact.ref], view: view.ref, cardinality: "many" },
      },
    },
  ],
});

// Published URLs enter the library and open a panel; tabs do not own the page location.
export const openView = defineView({
  id: "open-artifact",
  title: l10n("views.openArtifact", "Open artifact"),
  body: {
    kind: "webview",
    entry: packageAsset("./open-artifact.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
export const detail = definePage({
  id: "artifact",
  title: l10n("pages.artifact", "Artifact"),
  path: "artifacts/view",
  mode: workbenchModes.project,
  parent: library.ref,
  resource: { kinds: [artifact.ref] },
  main: { kind: "view", view: openView.ref, cardinality: "one" },
  slots: [],
});
