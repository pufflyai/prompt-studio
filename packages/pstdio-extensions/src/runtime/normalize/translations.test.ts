import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand, defineExtension, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { normalizeExtensionSources } from "./index";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const fixture = (bundle: Record<string, string>, title: string | ReturnType<typeof l10n> = "Create") => {
  const dir = mkdtempSync(join(tmpdir(), "translations-"));
  dirs.push(dir);
  writeFileSync(join(dir, "fr.json"), JSON.stringify(bundle));
  const sourcePath = join(dir, "extension.ts");
  return normalizeExtensionSources([
    {
      packagePath: dir,
      sourcePath,
      sourceKind: "local_path",
      manifest: {
        id: "test.lab",
        name: "lab",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: EXTENSION_API_VERSION,
      },
      definition: defineExtension({
        commands: [
          defineCommand({
            id: "create",
            title,
            palette: [{ label: l10n("shared.menu", "Menu") }],
            run: async () => null,
          }),
        ],
        translations: { fr: packageAsset("./fr.json", pathToFileURL(sourcePath).href) },
      }),
    },
  ]);
};

describe("automatic translation bundles", () => {
  test("loads locale overrides alongside generated defaults and runtime-only keys", () => {
    const runtime = fixture({ "contributions/commands/create/title": "Créer", "runtime.message": "Bonjour" });
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.translations[0].bundles).toEqual({
      en: { "contributions/commands/create/title": "Create", "shared.menu": "Menu" },
      fr: { "contributions/commands/create/title": "Créer", "runtime.message": "Bonjour" },
    });
  });
  test("reports stale automatic keys with the bundle and key", () => {
    const runtime = fixture({ "contributions/commands/removed/title": "Supprimé" });
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "stale_automatic_translation_key",
        sourcePath: expect.stringContaining("fr.json"),
        metadata: expect.objectContaining({ locale: "fr", key: "contributions/commands/removed/title" }),
      }),
    ]);
  });
  test("rejects explicit use of the automatic namespace", () => {
    const runtime = fixture({}, l10n("contributions/commands/create/title", "Create"));
    expect(runtime.diagnostics).toEqual([expect.objectContaining({ code: "reserved_translation_key" })]);
  });
});
