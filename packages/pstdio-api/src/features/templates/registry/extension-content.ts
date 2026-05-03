import { writeFile } from "node:fs/promises";
import { readPackageAssetText, resolvePackageAsset } from "pstdio-extensions";
import type { RuntimeTemplateRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../../deps";

export type ResolvedExtensionTemplate = {
  record: RuntimeTemplateRecord;
  extensionName: string;
};

export const findExtensionTemplate = async (
  deps: RouteDeps,
  extensionId: string,
  templateKey: string,
): Promise<ResolvedExtensionTemplate | null> => {
  const checkResult = await deps.extensionService.check();
  const record = checkResult.runtime.templates.find(
    (entry) => entry.extensionId === extensionId && entry.localId === templateKey,
  );
  if (!record) return null;
  const extension = checkResult.runtime.extensions.find((extension) => extension.id === record.extensionId);
  return { record, extensionName: extension?.displayName ?? record.extensionId };
};

export const readExtensionTemplateContent = async (resolved: ResolvedExtensionTemplate) => {
  return readPackageAssetText(resolved.record.contribution.source, {
    sourcePath: resolved.record.sourcePath,
  });
};

export const writeExtensionTemplateContent = async (resolved: ResolvedExtensionTemplate, content: string) => {
  const asset = resolvePackageAsset(resolved.record.contribution.source, {
    sourcePath: resolved.record.sourcePath,
  });
  await writeFile(asset.path, content);
};
