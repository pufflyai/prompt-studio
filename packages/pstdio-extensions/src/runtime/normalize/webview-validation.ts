import { extname } from "node:path";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { parseWebviewCapabilityDeclaration, validateWebviewCapabilityNames } from "../../bridge/contract/capabilities";
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
  key: string,
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

  // An artifact grant may only name a mount the same extension defines.
  const mountIds = definedArtifactMountIds(source);
  for (const declaration of capabilities) {
    if (typeof declaration !== "string") continue;
    const parsed = parseWebviewCapabilityDeclaration(declaration);
    if (parsed.name !== "artifacts.read" || !parsed.scope) continue;
    if (mountIds.has(parsed.scope)) continue;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "webview_artifact_mount_missing",
        message: `View ${key} declares artifacts.read:${parsed.scope} but the extension defines no artifact mount "${parsed.scope}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      }),
    );
  }
};

const definedArtifactMountIds = (source: LoadedExtensionSource) => {
  const ids = new Set<string>();
  if (!Array.isArray(source.definition.artifactMounts)) return ids;
  for (const mount of source.definition.artifactMounts) {
    if (isRecord(mount) && typeof mount.id === "string") ids.add(mount.id);
  }
  return ids;
};

const validateViews = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  if (!Array.isArray(source.definition.views)) return;
  for (const view of source.definition.views) {
    if (!isRecord(view) || !isRecord(view.body) || view.body.kind !== "webview") continue;
    validateEntry(ext, source, runtime, String(view.id), view.body.entry);
    validateCapabilities(ext, source, runtime, String(view.id), view.body.capabilities);
  }
};

export const registerWebviewValidation = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => validateViews(ext, source, runtime);
