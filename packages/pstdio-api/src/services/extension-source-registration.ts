import { isAbsolute } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { publishedExtensionsId } from "../features/extensions/publication/types";
import type { RegisterInstalledSourceInput } from "./extension-service";

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
  const unresolved = (await service.list()).filter(
    (source) =>
      source.extension_id === input.extensionId &&
      source.version === null &&
      !isAbsolute(source.source_path) &&
      URL.canParse(source.source_path),
  );
  return unresolved.length === 1 ? unresolved[0] : null;
};

export const refreshPathForRegistration = (existingPath: string, input: RegistrationIdentity) =>
  existingPath === input.sourcePath ? input.sourcePath : undefined;

export const registrationValues = (
  input: RegisterInstalledSourceInput,
  existing: Awaited<ReturnType<typeof findInstalledSourceForRegistration>>,
) => ({
  display_name: input.displayName,
  extension_id: input.extensionId,
  manifest_json: input.manifest,
  source_hash: input.sourceHash ?? existing?.source_hash ?? null,
  source_kind: input.sourceKind ?? existing?.source_kind ?? "local_path",
  source_path: input.sourcePath,
  // `null` means the new source has no git ref, so an older ref must not survive a reinstall.
  source_ref: input.sourceRef === undefined ? (existing?.source_ref ?? null) : input.sourceRef,
  status: "loaded" as const,
  version: input.version ?? null,
  last_loaded_at: new Date().toISOString(),
  last_error_json: null,
});

export const createInstalledSourceRegistrar = (deps: {
  sources: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  emitInstalledSource: (source: unknown) => void;
}) => {
  const { emitInstalledSource } = deps;
  return async (input: RegisterInstalledSourceInput, notify: (sourcePath?: string) => Promise<void>) => {
    if (input.extensionId === publishedExtensionsId) throw new Error("Reserved platform extension identity");
    const existing = await findInstalledSourceForRegistration(deps.sources, input);
    const values = registrationValues(input, existing);

    if (existing) {
      if (hasUnchangedInstalledSourceRegistration(existing, values)) return existing;

      const updated = await deps.sources.updateRegistration(existing.id, values);
      if (!updated) throw new Error(`Installed extension not found: ${input.installName}`);
      emitInstalledSource(updated);
      await notify(refreshPathForRegistration(existing.source_path, input));
      return updated;
    }

    try {
      const registered = await deps.sources.register({
        install_name: input.installName,
        ...values,
      });
      emitInstalledSource(registered);
      await notify(input.sourcePath);
      return registered;
    } catch (error) {
      const raced = await deps.sources.getBySourcePath(input.sourcePath);
      if (!raced) throw error;
      const updated = await deps.sources.updateRegistration(raced.id, values);
      if (!updated) throw error;
      emitInstalledSource(updated);
      await notify(input.sourcePath);
      return updated;
    }
  };
};
