import { expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  defineNavigationTree,
  defineView,
  packageAsset,
  type ViewRef,
} from "@pstdio/sdk/extensions";
import { createWorkbenchExtensionMetadata } from "../workbench/metadata/workbench-extension-metadata";
import { collectConventionDiagnostics } from "./conventions";
import type { LoadedExtensionSource } from "./loader";
import { normalizeExtensionSources } from "./normalize";

const source = (name: string, definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `example.${name}`,
    name,
    version: "1.0.0",
    publisher: "example",
    main: "./extension.ts",
    enginesPstdio: "^0.4.0",
  },
  definition,
});
const mode = defineMode({ id: "review", label: "Review", regions: ["main"] });
const shared: ViewRef = { kind: "view", extensionId: "example.provider", id: "shared" };
const consumer = (view = shared, optionalView = true) =>
  source(
    "consumer",
    defineExtension({
      modes: [mode],
      navigationTrees: [defineNavigationTree({ id: "related", owner: mode.ref, view, optionalView })],
    }),
  );
const provider = (tree = true) =>
  source(
    "provider",
    defineExtension({
      views: [
        defineView({
          id: "shared",
          title: "Related",
          body: tree
            ? { kind: "tree", body: async () => [] }
            : { kind: "webview", entry: packageAsset("./view.tsx", "file:///fake/provider/") },
        }),
      ],
    }),
  );
const inspect = (sources: LoadedExtensionSource[]) => {
  const runtime = normalizeExtensionSources(sources);
  return {
    codes: collectConventionDiagnostics(runtime).map((item) => item.code),
    metadata: createWorkbenchExtensionMetadata({ runtime, resolveWebview: () => null }),
  };
};
test("an optional foreign navigation view stays inactive until its provider is enabled", () => {
  const absent = inspect([consumer()]);
  expect(absent.codes).not.toContain("extension_view_reference_missing");
  expect(absent.metadata.navigationTrees).toEqual([]);
  const enabled = inspect([consumer(), provider()]);
  expect(enabled.codes).toEqual([]);
  expect(enabled.metadata.navigationTrees).toMatchObject([{ view: shared }]);
  expect(inspect([consumer()]).metadata.navigationTrees).toEqual([]);
});
test("optional navigation views still validate local and present-provider references", () => {
  expect(inspect([consumer(shared, false)]).codes).toContain("extension_view_reference_missing");
  expect(inspect([consumer({ ...shared, extensionId: "example.consumer" })]).codes).toContain(
    "extension_view_reference_missing",
  );
  expect(inspect([consumer({ ...shared, id: "typo" }), provider()]).codes).toContain(
    "extension_view_reference_missing",
  );
  expect(inspect([consumer(), provider(false)]).codes).toContain("extension_navigation_tree_view_invalid");
});
