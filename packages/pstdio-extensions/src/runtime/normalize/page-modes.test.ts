import { expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  definePage,
  defineView,
  type ModeRef,
  packageAsset,
} from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { normalizeExtensionSources } from "./index";

const view = defineView({
  id: "empty",
  title: "Empty",
  body: { kind: "webview", entry: packageAsset("./empty.tsx", "file:///test/") },
});
const mode = defineMode({ id: "music", label: "Music", regions: ["main"], basePage: { kind: "page", id: "home" } });
const base = {
  id: "home",
  title: "Home",
  path: "home",
  main: { kind: "view" as const, view: view.ref, cardinality: "one" as const },
  slots: [],
};
const normalize = (modes: readonly ModeRef[], legacyMode = mode.ref) => {
  const page = definePage({ ...base, mode: legacyMode, modes });
  return normalizeExtensionSources([
    {
      packagePath: "/test",
      sourcePath: "/test/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "test.music",
        name: "music",
        version: "1.0.0",
        publisher: "test",
        main: "./extension.ts",
        enginesPstdio: `^${EXTENSION_API_VERSION}`,
      },
      definition: defineExtension({ modes: [mode], pages: [page], views: [view] }),
    },
  ]);
};

test("rejects duplicate allowed modes", () => {
  expect(normalize([mode.ref, mode.ref]).diagnostics.length).toBeGreaterThan(0);
});
test("rejects conflicts between legacy mode and modes", () => {
  expect(normalize([{ kind: "mode", extensionId: "pstdio", id: "project" }]).diagnostics.length).toBeGreaterThan(0);
});
test("accepts allowed modes with a valid mode base page", () => {
  const page = definePage({ ...base, mode: mode.ref, modes: [mode.ref] });
  expect(page.mode).toEqual(mode.ref);
  expect(normalize([mode.ref]).diagnostics).toEqual([]);
});

test("rejects an unknown allowed mode", () => {
  expect(normalize([mode.ref, { kind: "mode", id: "missing" }]).diagnostics).toContainEqual(
    expect.objectContaining({ code: "extension_page_mode_invalid" }),
  );
});
