import { existsSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionDiagnostic, ExtensionsCheckResponse } from "pstdio-api-contracts";
import { classifyWebviewEntry, isPackageAssetDescriptor } from "./extension-webviews";

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const slotId = (slot: unknown) => (isRecord(slot) && typeof slot.id === "string" ? slot.id : String(slot));

export const commandIdFromRef = (value: unknown) => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
};

export const eventIdFromRef = (value: unknown) => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
};

export const addDiagnostic = (check: ExtensionsCheckResponse, diagnostic: ExtensionDiagnostic) => {
  check.diagnostics.push(diagnostic);
  if (diagnostic.severity === "error") check.errorCount += 1;
  if (diagnostic.severity === "warning") check.warningCount += 1;
};

export const validatePackageAsset = (
  check: ExtensionsCheckResponse,
  asset: unknown,
  input: { code: string; extensionId: string; message: string; sourcePath: string },
) => {
  if (!isPackageAssetDescriptor(asset)) {
    addDiagnostic(check, {
      code: input.code,
      extensionId: input.extensionId,
      message: `${input.message} must use packageAsset(...)`,
      severity: "error",
      sourcePath: input.sourcePath,
    });
    return;
  }

  if (!asset.baseUrl.startsWith("file:")) return;

  const filePath = fileURLToPath(new URL(asset.path, asset.baseUrl));
  if (!existsSync(filePath)) {
    addDiagnostic(check, {
      code: "package_asset_missing",
      extensionId: input.extensionId,
      message: `Package asset is missing: ${asset.path}`,
      severity: "warning",
      sourcePath: input.sourcePath,
    });
  }
};

export const validateWebviewEntry = (
  check: ExtensionsCheckResponse,
  asset: unknown,
  input: { code: string; extensionId: string; message: string; sourcePath: string },
) => {
  validatePackageAsset(check, asset, input);
  if (!isPackageAssetDescriptor(asset)) return;

  const classification = classifyWebviewEntry(asset);
  if (classification.kind !== "unsupported") return;

  addDiagnostic(check, {
    code: `${input.code}_unsupported`,
    extensionId: input.extensionId,
    message: `${input.message} must point to .html or browser source; received ${classification.extension || "no extension"}`,
    severity: "error",
    sourcePath: input.sourcePath,
  });
};

export const validateArtifactPath = (path: string) => {
  const normalized = normalize(path);
  return !isAbsolute(path) && normalized !== ".." && !normalized.startsWith(`..${"/"}`) && normalized !== ".";
};
