import { pathToFileURL } from "node:url";
import { remapRuntimePackageAssets } from "../remap-package-assets";

export interface PreparedExtensionEntry {
  entryPath: string;
  packagePath: string;
}
const entries = new Map<string, PreparedExtensionEntry>();
export const readPreparedExtensionEntry = (sourcePath: string) => entries.get(sourcePath);
export const recordPreparedExtensionEntry = (sourcePath: string, entry: PreparedExtensionEntry) =>
  entries.set(sourcePath, entry);
export const restorePreparedExtensionDefinition = async (prepared: PreparedExtensionEntry, packagePath: string) => {
  const mod = await import(`${pathToFileURL(prepared.entryPath).href}?pstdio_owner=${process.pid}`);
  return remapRuntimePackageAssets(mod, prepared.packagePath, packagePath) as Record<string, unknown>;
};
