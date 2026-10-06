import { readFileSync } from "node:fs";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { PackageAssetError, resolvePackageAsset } from "../../artifacts/package-assets";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";

const stripJsonComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const stripTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, "$1");

export const parseJsonc = (path: string) =>
  JSON.parse(stripTrailingCommas(stripJsonComments(readFileSync(path, "utf8")))) as unknown;

export const addAppearanceDiagnostic = (
  runtime: Accumulator,
  input: { code: string; message: string; extensionId: string; sourcePath: string },
) => runtime.diagnostics.push(createDiagnostic(input));

export const validateContributionAsset = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  asset: unknown,
  codePrefix: "theme" | "file_icon_theme",
) => {
  if (!isPackageAssetDescriptor(asset)) {
    addAppearanceDiagnostic(runtime, {
      code: `${codePrefix}_source_invalid`,
      message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.name}.${localId}" must declare source via packageAsset()`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
    return null;
  }

  try {
    return resolvePackageAsset(asset, { sourcePath: source.sourcePath });
  } catch (error) {
    if (error instanceof PackageAssetError) {
      addAppearanceDiagnostic(runtime, {
        code: `${codePrefix}_source_invalid`,
        message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.name}.${localId}" asset is unavailable: ${error.message}`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
    }
    return null;
  }
};
