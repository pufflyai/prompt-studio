import { resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";

const translationDiagnosticCodes = new Set([
  "malformed_translation_bundle",
  "missing_translation_asset",
  "missing_translation_key",
]);

const root = resolve(import.meta.dir, "../..");
const loaded = await loadExtensionSources({
  extensionRoots: [{ path: resolve(root, "extensions"), sourceKind: "local_path" }],
});
const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
const failures = runtime.diagnostics.filter((diagnostic) => translationDiagnosticCodes.has(diagnostic.code));

if (failures.length > 0) {
  for (const diagnostic of failures) {
    const source = diagnostic.sourcePath ? ` (${diagnostic.sourcePath})` : "";
    console.error(`${diagnostic.code}: ${diagnostic.message}${source}`);
  }
  process.exit(1);
}

console.log(`Verified translations for ${runtime.extensions.length} extensions.`);
