import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineExtension, defineMode, defineTheme, defineView, packageAsset } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("publishes qualified mode theme and chrome references through the metadata contract", async () => {
  const packagePath = await mkdtemp(join(tmpdir(), "mode-defaults-"));
  await writeFile(join(packagePath, "paper.json"), JSON.stringify({ colors: { "editor.background": "#ffffff" } }));
  const baseUrl = pathToFileURL(join(packagePath, "extension.ts")).href;
  const theme = defineTheme({
    id: "paper",
    title: "Paper",
    format: "vscode-color-theme",
    source: packageAsset("./paper.json", baseUrl),
  });
  const view = defineView({
    id: "navigation",
    title: "Navigation",
    body: { kind: "webview", entry: packageAsset("./navigation.tsx", import.meta.url) },
  });
  const mode = defineMode({
    id: "notes",
    label: "Notes",
    regions: ["main"],
    defaultTheme: theme.ref,
    chrome: { sidenav: view.ref, nav: false, activity: false },
    regionSettings: { sidenav: { size: { defaultPx: 240 }, collapsible: false } },
  });
  const source: LoadedExtensionSource = {
    packagePath,
    sourcePath: join(packagePath, "extension.ts"),
    sourceKind: "local_path",
    manifest: {
      id: "example.notes",
      name: "notes",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: "1.0.0-alpha.9",
    },
    definition: defineExtension({ modes: [mode], themes: [theme], views: [view] }),
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.diagnostics).toEqual([]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  await rm(packagePath, { recursive: true, force: true });
  expect(metadata.modes[0]).toMatchObject({
    defaultTheme: { extensionId: "example.notes", kind: "theme", id: "paper" },
    chrome: { sidenav: { extensionId: "example.notes", kind: "view", id: "navigation" }, nav: false, activity: false },
    regionSettings: { sidenav: { size: { defaultPx: 240 }, collapsible: false } },
  });
});
