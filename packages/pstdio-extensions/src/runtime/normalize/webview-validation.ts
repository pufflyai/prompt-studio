import { extname } from "node:path";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { validateWebviewCapabilityNames } from "../../bridge/contract/capabilities";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

const managedExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const validateEntry = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  key: string,
  entry: unknown,
) => {
  if (!isPackageAssetDescriptor(entry)) return;
  const extension = extname(entry.path).toLowerCase();
  if (managedExtensions.has(extension)) return;
  runtime.diagnostics.push(
    createDiagnostic({
      code: "view_webview_unsupported",
      message: `View ${key} webview entry must point to browser source; received ${extension || "no extension"}`,
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

const validateViews = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  if (!Array.isArray(source.definition.views)) return;
  for (const view of source.definition.views) {
    if (!isRecord(view) || !isRecord(view.body) || view.body.kind !== "webview") continue;
    validateEntry(ext, source, runtime, String(view.id), view.body.entry);
    validateCapabilities(ext, source, runtime, view.body.capabilities);
  }
};

export const registerWebviewValidation = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => validateViews(ext, source, runtime);
