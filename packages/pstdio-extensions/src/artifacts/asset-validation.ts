import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPackageAssetDescriptor = (value: unknown): value is PackageAssetDescriptor => {
  if (!isRecord(value)) return false;

  return (
    value.kind === "package-asset" &&
    typeof value.path === "string" &&
    value.path.length > 0 &&
    typeof value.baseUrl === "string" &&
    value.baseUrl.length > 0
  );
};
