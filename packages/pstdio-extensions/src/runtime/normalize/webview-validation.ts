import { extname } from "node:path";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { validateWebviewCapabilityNames } from "../../bridge/contract/capabilities";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

const webviewContributionMaps = [
  "activityRenderers",
  "routes",
  "sessionAnchorRenderers",
  "settingsPanels",
  "panels",
] as const;

type WebviewMapKey = (typeof webviewContributionMaps)[number];

const managedExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const codeFor = (mapKey: WebviewMapKey) => (mapKey === "routes" ? "route" : mapKey) as string;

const validateEntry = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  mapKey: WebviewMapKey,
  key: string,
  entry: unknown,
) => {
  if (!isPackageAssetDescriptor(entry)) return;
  const extension = extname(entry.path).toLowerCase();
  if (managedExtensions.has(extension)) return;
  runtime.diagnostics.push(
    createDiagnostic({
      code: `${codeFor(mapKey)}_webview_unsupported`,
      message: `${mapKey} ${key} webview entry must point to browser source; received ${extension || "no extension"}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    }),
  );
};

const validateCapabilities = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  capabilities: unknown,
) => {
  if (!Array.isArray(capabilities)) return;
  for (const diagnostic of validateWebviewCapabilityNames(capabilities)) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: diagnostic.code,
        message: diagnostic.message,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      }),
    );
  }
};

const validateContributionMap = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  mapKey: WebviewMapKey,
) => {
  const contributions = source.definition[mapKey];
  if (!isRecord(contributions)) return;
  for (const [key, contribution] of Object.entries(contributions)) {
    if (!isRecord(contribution) || !isRecord(contribution.webview)) continue;
    validateEntry(ext, source, runtime, mapKey, key, contribution.webview.entry);
    validateCapabilities(ext, source, runtime, contribution.webview.capabilities);
  }
};

export const registerWebviewValidation = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const mapKey of webviewContributionMaps) {
    validateContributionMap(ext, source, runtime, mapKey);
  }
};
