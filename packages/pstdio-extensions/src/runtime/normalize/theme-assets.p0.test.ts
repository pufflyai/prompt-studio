import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineExtension, defineTheme, packageAsset } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

test("reports unsupported theme assets without losing healthy themes", async () => {
  const packagePath = await mkdtemp(join(tmpdir(), "theme-assets-"));
  try {
    await writeFile(join(packagePath, "external.json"), JSON.stringify({ tokenColors: "./syntax.tmTheme" }));
    await writeFile(join(packagePath, "valid.json"), JSON.stringify({ colors: { "editor.background": "#123456" } }));
    const sourcePath = join(packagePath, "extension.ts");
    const source: LoadedExtensionSource = {
      packagePath,
      sourcePath,
      sourceKind: "local_path",
      manifest: {
        id: "example.palette",
        name: "palette",
        publisher: "example",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: "^0.1.0",
      },
      definition: defineExtension({
        themes: ["external", "valid"].map((id) =>
          defineTheme({
            id,
            title: id,
            format: "vscode-color-theme",
            source: packageAsset(`./${id}.json`, pathToFileURL(sourcePath).href),
          }),
        ),
      }),
    };
    const runtime = normalizeExtensionSources([source]);
    expect(runtime.themes.map((theme) => theme.localId)).toEqual(["valid"]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({ code: "malformed_theme_asset", message: expect.stringContaining("inline array") }),
    ]);
  } finally {
    await rm(packagePath, { recursive: true, force: true });
  }
});
