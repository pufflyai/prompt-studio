import { isAbsolute } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { acceptPreparedRevision, preparedRevisionState, readAcceptedRevision } from "pstdio-extensions";
import {
  activatePreparedInstall,
  assertPreparedInstallOwned,
  settlePreparedInstall,
} from "../features/extensions/extension-install-transaction";
import { runExtensionPreparation } from "../features/extensions/extension-preparation";
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
  // Runtime views carry callbacks. Compare the same JSON representation the
  // database stores, so unchanged callbacks do not trigger adoption and builds.
  manifest_json: JSON.parse(JSON.stringify(input.manifest)) as RegisterInstalledSourceInput["manifest"],
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

type RegistrarDeps = {
  sources: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  emitInstalledSource: (source: unknown) => void;
};
const registerRow = async (
  deps: RegistrarDeps,
  input: RegisterInstalledSourceInput,
  existing: Awaited<ReturnType<typeof findInstalledSourceForRegistration>>,
  values: ReturnType<typeof registrationValues>,
) => {
  if (existing && hasUnchangedInstalledSourceRegistration(existing, values)) return existing;
  if (existing) return deps.sources.updateRegistration(existing.id, values);
  try {
    return await deps.sources.register({ install_name: input.installName, ...values });
  } catch (error) {
    const raced = await deps.sources.getBySourcePath(input.sourcePath);
    if (!raced) throw error;
    return deps.sources.updateRegistration(raced.id, values);
  }
};
const rollbackRegistration = async (
  deps: RegistrarDeps,
  input: RegisterInstalledSourceInput,
  state: {
    existing: Awaited<ReturnType<typeof findInstalledSourceForRegistration>>;
    registered: Awaited<ReturnType<typeof findInstalledSourceForRegistration>>;
    previousRevision: Awaited<ReturnType<typeof readAcceptedRevision>>;
    published: boolean;
    values: ReturnType<typeof registrationValues>;
  },
  notify: (sourcePath?: string) => Promise<void>,
) => {
  let owns = true;
  if (input.installation) {
    owns = await assertPreparedInstallOwned(input.installation).then(
      () => true,
      () => false,
    );
    await settlePreparedInstall(input.installation, false);
  }
  const current = await deps.sources.getBySourcePath(input.sourcePath);
  const accepted = await readAcceptedRevision(input.sourcePath);
  if (
    !owns ||
    (state.published && accepted?.id !== input.preparedRevision?.id) ||
    current?.source_hash !== state.values.source_hash
  )
    return;
  if (state.published && state.previousRevision)
    await acceptPreparedRevision(input.sourcePath, state.previousRevision, {
      expectedState: preparedRevisionState(input.preparedRevision!),
    });
  else if (state.published) await runExtensionPreparation("runtime.forget", { sourcePath: input.sourcePath });
  if (state.existing) {
    const restored = await deps.sources.updateRegistration(state.existing.id, { ...state.existing });
    if (restored) deps.emitInstalledSource(restored);
  } else if (state.registered) await deps.sources.remove(state.registered.id);
  await notify(input.sourcePath).catch(() => {});
};
const publishPreparedRegistration = async (
  input: RegisterInstalledSourceInput,
  previous: Awaited<ReturnType<typeof readAcceptedRevision>>,
) => {
  if (input.installation) await assertPreparedInstallOwned(input.installation);
  if (!input.preparedRevision) return false;
  await acceptPreparedRevision(input.sourcePath, input.preparedRevision, {
    expectedState: preparedRevisionState(previous),
  });
  return true;
};
const registrationNotification = (
  input: RegisterInstalledSourceInput,
  existing: Awaited<ReturnType<typeof findInstalledSourceForRegistration>>,
  values: ReturnType<typeof registrationValues>,
) => ({
  changed: !existing || !hasUnchangedInstalledSourceRegistration(existing, values),
  path: existing ? refreshPathForRegistration(existing.source_path, input) : input.sourcePath,
});
export const createInstalledSourceRegistrar =
  (deps: RegistrarDeps) =>
  async (input: RegisterInstalledSourceInput, notify: (sourcePath?: string) => Promise<void>) => {
    if (input.extensionId === publishedExtensionsId) throw new Error("Reserved platform extension identity");
    const existing = await findInstalledSourceForRegistration(deps.sources, input);
    const values = registrationValues(input, existing);
    const previousRevision = input.preparedRevision ? await readAcceptedRevision(input.sourcePath) : null;
    const state = { existing, values, previousRevision, registered: null as typeof existing, published: false };
    try {
      if (input.installation) await activatePreparedInstall(input.installation);
      state.registered = await registerRow(deps, input, existing, values);
      if (!state.registered) throw new Error(`Installed extension not found: ${input.installName}`);
      state.published = await publishPreparedRegistration(input, previousRevision);
      const notification = registrationNotification(input, existing, values);
      if (notification.changed) await notify(notification.path);
      if (input.installation) await settlePreparedInstall(input.installation, true);
      deps.emitInstalledSource(state.registered);
      return state.registered;
    } catch (error) {
      await rollbackRegistration(deps, input, state, notify);
      throw error;
    }
  };
