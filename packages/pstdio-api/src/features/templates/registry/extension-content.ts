import { readPackageAssetText } from "pstdio-extensions";
import type { RuntimeTemplateRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../../deps";

export type ResolvedExtensionTemplate = {
  record: RuntimeTemplateRecord;
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
  return { record };
};

export const readExtensionTemplateContent = async (resolved: ResolvedExtensionTemplate) => {
  return readPackageAssetText(resolved.record.contribution.source, {
    sourcePath: resolved.record.sourcePath,
  });
};
