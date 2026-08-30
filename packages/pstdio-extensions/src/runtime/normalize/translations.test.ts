import { describe, expect, test } from "bun:test";
import { defineCommand, defineExtension, l10n } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "1.0.0-alpha.4",
  },
  definition,
});

describe("normalizeExtensionSources translations", () => {
  test("reports a translation key that declares two different defaults", () => {
    // Only the first default reaches the bundle, so the second copy would silently
    // never appear in the UI.
    const definition = defineExtension({
      commands: [
        defineCommand({ id: "open", title: l10n("lab.title", "Lab"), async run() {} }),
        defineCommand({ id: "open-mode", title: l10n("lab.title", "Lab mode"), async run() {} }),
      ],
    });

    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "conflicting_translation_default",
        severity: "warning",
        metadata: expect.objectContaining({ key: "lab.title" }),
      }),
    ]);
    expect(runtime.translations[0]?.bundles.en?.["lab.title"]).toBe("Lab");
  });

  test("accepts one default reused for the same key", () => {
    const definition = defineExtension({
      commands: [
        defineCommand({ id: "open", title: l10n("lab.title", "Lab"), async run() {} }),
        defineCommand({ id: "focus", title: l10n("lab.title", "Lab"), async run() {} }),
      ],
    });

    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.translations[0]?.bundles.en?.["lab.title"]).toBe("Lab");
  });
});
