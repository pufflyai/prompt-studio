import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { isLocalizedString } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionSources } from "../loader";
import { normalizeExtensionSources } from "./index";

const root = resolve(import.meta.dir, "../../../../..");
describe("first-party static localization", () => {
  test.each(["pstdio-planner", "extension-lab"])("normalizes %s with collected fallback bundles", async (name) => {
    const loaded = await loadExtensionSources({
      extensionPackages: [{ path: resolve(root, "extensions", name), sourceKind: "local_path" }],
    });
    expect(loaded.diagnostics).toEqual([]);
    const runtime = normalizeExtensionSources(loaded.sources);
    expect(runtime.diagnostics.filter((item) => item.code.includes("translation"))).toEqual([]);
    const source = loaded.sources[0];
    const bundle = runtime.translations.find((item) => item.extensionId === source.manifest.id)!;
    const view = source.definition.views?.find((item) => typeof item.title === "string");
    if (!view || typeof view.title !== "string") throw new Error("Expected a static plain title");
    const normalized = runtime.views.find((item) => item.localId === view.id)!.contribution.title;
    expect(isLocalizedString(normalized)).toBe(true);
    if (!isLocalizedString(normalized)) throw new Error("Expected a normalized title");
    expect(normalized.$l10n).toBe(`contributions/views/${view.id}/title`);
    expect(bundle.bundles.en[normalized.$l10n]).toEqual(view.title);
    if (name === "pstdio-planner") {
      for (const locale of ["es", "fr", "ja", "ko", "zh-Hans", "zh-Hant"]) {
        expect(bundle.bundles[locale]).toHaveProperty("contributions/views/tickets/body/createRow/submitLabel");
        expect(bundle.bundles[locale]["kanbanRenderers.tickets.title"]).toBeDefined();
      }
    } else {
      expect(Object.keys(bundle.bundles)).toEqual(["en"]);
    }
  });
});
