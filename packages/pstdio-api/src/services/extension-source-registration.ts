import { type createInstalledExtensionSourcesDBService, legacyTemplateOwnerSourcePath } from "pstdio-db";

/** The parts of a registration that name the record it belongs to. */
type RegistrationIdentity = { extensionId: string; sourcePath: string };

export type InstalledSourceRegistrationSnapshot = {
  display_name: string;
  extension_id: string;
  last_error_json: unknown;
  manifest_json: unknown;
  source_hash: string | null;
  source_kind: string;
  source_path: string;
  source_ref: string | null;
  status: string;
  version: string | null;
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const jsonObjectKeys = (value: Record<string, unknown>) =>
  Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();

const jsonEquals = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = left ?? null;
  const normalizedRight = right ?? null;

  if (normalizedLeft === normalizedRight) return true;

  if (Array.isArray(normalizedLeft) || Array.isArray(normalizedRight)) {
    if (!Array.isArray(normalizedLeft) || !Array.isArray(normalizedRight)) return false;
    if (normalizedLeft.length !== normalizedRight.length) return false;
    return normalizedLeft.every((item, index) => jsonEquals(item, normalizedRight[index]));
  }

  if (isJsonObject(normalizedLeft) || isJsonObject(normalizedRight)) {
    if (!isJsonObject(normalizedLeft) || !isJsonObject(normalizedRight)) return false;
    const leftKeys = jsonObjectKeys(normalizedLeft);
    const rightKeys = jsonObjectKeys(normalizedRight);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key, index) => key === rightKeys[index] && jsonEquals(normalizedLeft[key], normalizedRight[key]),
    );
  }

  return false;
};

export const hasUnchangedInstalledSourceRegistration = (
  existing: InstalledSourceRegistrationSnapshot,
  values: InstalledSourceRegistrationSnapshot,
) =>
  existing.display_name === values.display_name &&
  existing.extension_id === values.extension_id &&
  jsonEquals(existing.manifest_json, values.manifest_json) &&
  existing.source_hash === values.source_hash &&
  existing.source_kind === values.source_kind &&
  existing.source_path === values.source_path &&
  existing.source_ref === values.source_ref &&
  existing.status === values.status &&
  existing.version === values.version &&
  jsonEquals(existing.last_error_json, values.last_error_json);

export const findInstalledSourceForRegistration = async (
  service: ReturnType<typeof createInstalledExtensionSourcesDBService>,
  input: RegistrationIdentity,
) => {
  const existing = await service.getBySourcePath(input.sourcePath);
  if (existing) return existing;
  return service.getBySourcePath(legacyTemplateOwnerSourcePath(input.extensionId));
};

export const refreshPathForRegistration = (existingPath: string, input: RegistrationIdentity) =>
  existingPath === legacyTemplateOwnerSourcePath(input.extensionId) ? undefined : input.sourcePath;
