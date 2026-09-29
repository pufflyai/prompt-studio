import { dirname } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import {
  checkExtensionSource,
  hashExtensionSource,
  type LoadedExtension,
} from "../features/extensions/extension-runtime";

type JsonRecord = Record<string, unknown>;

type ReloadDeps = {
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  emitInstalledSource: (source: unknown) => void;
  notifyInstalledSourcesChanged: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void>;
  hashExtension?: typeof hashExtensionSource;
  checkExtension?: typeof checkExtensionSource;
};

type InstalledSource = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createInstalledExtensionSourcesDBService>["get"]>>
>;

export type ExpectedWebviewBuildSource = {
  sourceHash?: string | null;
  sourcePath: string;
};

export const buildErrorJson = (code: string, error: unknown, details: JsonRecord = {}) => {
  const diagnostics =
    typeof error === "object" && error !== null && "diagnostics" in error
      ? (error as { diagnostics?: unknown }).diagnostics
      : undefined;

  return {
    code,
    message: error instanceof Error ? error.message : String(error),
    ...(Array.isArray(diagnostics) ? { diagnostics } : {}),
    ...details,
  };
};

// Carries the first validation error, so the stored load error names the actual problem
// (for example an unsupported API version) instead of a generic reload failure.
class ExtensionValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: unknown[],
  ) {
    super(message);
  }
}

const validationError = (diagnostics: Array<{ code: string; message: string; severity: string }>) => {
  const first = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  return new ExtensionValidationError(
    first?.code ?? "extension_reload_failed",
    first?.message ?? "Extension validation failed",
    diagnostics,
  );
};

const reloadInstalledSourceRow = async (deps: ReloadDeps, existing: InstalledSource) => {
  const hash = deps.hashExtension ?? hashExtensionSource;
  const check = deps.checkExtension ?? checkExtensionSource;
  let nextSourceHash: string | null = null;

  try {
    nextSourceHash = hash(existing.source_path);
    const result = await check(existing.source_path, dirname(existing.source_path));
    if (!result.loaded || result.check.errorCount > 0) throw validationError(result.check.diagnostics);

    const nextRevision = crypto.randomUUID();
    const updated = await deps.installedExtensionSourcesService.updateRegistration(existing.id, {
      display_name: result.loaded.metadata.displayName,
      extension_id: result.loaded.metadata.id,
      manifest_json: result.loaded.manifest,
      source_hash: nextSourceHash,
      status: "pending",
      version: result.loaded.metadata.version ?? null,
      last_error_json: null,
    });
    if (!updated) throw new Error(`Installed extension not found: ${existing.id}`);

    await deps.notifyInstalledSourcesChanged(existing.source_path, result.loaded);
    const refreshed = await deps.installedExtensionSourcesService.get(existing.id);
    if (!refreshed) throw new Error(`Installed extension not found: ${existing.id}`);

    const completed =
      refreshed.status === "pending"
        ? await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
            loaded_revision:
              refreshed.loaded_revision !== existing.loaded_revision ? refreshed.loaded_revision : nextRevision,
            status: "loaded",
            last_loaded_at: new Date().toISOString(),
            last_error_json: null,
          })
        : refreshed;
    if (!completed) throw new Error(`Installed extension not found: ${existing.id}`);

    await deps.installedExtensionSourcesService.recordReload({
      installed_extension_id: existing.id,
      previous_source_hash: existing.source_hash,
      next_source_hash: nextSourceHash,
      previous_revision: existing.loaded_revision,
      next_revision: completed.loaded_revision,
      status: completed.status === "error" ? "error" : "success",
      ...(completed.status === "error" ? { error_json: completed.last_error_json } : {}),
    });

    deps.emitInstalledSource(completed);
    return { installedSource: completed, check: result.check };
  } catch (error) {
    const code = error instanceof ExtensionValidationError ? error.code : "extension_reload_failed";
    const currentErrorJson = buildErrorJson(code, error);
    // Source that failed validation is never adopted: keep the hash the project accepted so the
    // extension still reports an update waiting rather than looking up to date and broken.
    const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
      source_hash: existing.source_hash,
      status: "error",
      last_error_json: currentErrorJson,
    });
    if (!updated) throw new Error(`Installed extension not found: ${existing.id}`);

    await deps.installedExtensionSourcesService.recordReload({
      installed_extension_id: existing.id,
      previous_source_hash: existing.source_hash,
      next_source_hash: nextSourceHash ?? existing.source_hash,
      previous_revision: existing.loaded_revision,
      next_revision: existing.loaded_revision,
      status: "error",
      error_json: currentErrorJson,
    });

    deps.emitInstalledSource(updated);
    await deps.notifyInstalledSourcesChanged(existing.source_path);
    return { installedSource: updated, check: null };
  }
};

export const reloadInstalledSourceBySourcePath = async (deps: ReloadDeps, sourcePath: string) => {
  const existing = await deps.installedExtensionSourcesService.getBySourcePath(sourcePath);
  if (!existing) throw new Error(`Installed extension not found at source path: ${sourcePath}`);

  return reloadInstalledSourceRow(deps, existing);
};

export const reportWebviewBuildFailure = async (
  deps: ReloadDeps,
  installName: string,
  webviewId: string,
  error: unknown,
  expectedSource?: ExpectedWebviewBuildSource,
) => {
  const existing = await deps.installedExtensionSourcesService.getByInstallName(installName);
  if (!existing) throw new Error(`Installed extension not found: ${installName}`);
  if (
    expectedSource &&
    (existing.source_hash !== (expectedSource.sourceHash ?? null) || existing.source_path !== expectedSource.sourcePath)
  ) {
    return existing;
  }

  const currentErrorJson = buildErrorJson("extension_webview_build_failed", error, { webviewId });
  const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
    status: "error",
    last_error_json: currentErrorJson,
  });
  if (!updated) throw new Error(`Installed extension not found: ${installName}`);

  await deps.installedExtensionSourcesService.recordReload({
    installed_extension_id: existing.id,
    previous_source_hash: existing.source_hash,
    next_source_hash: existing.source_hash,
    previous_revision: existing.loaded_revision,
    next_revision: existing.loaded_revision,
    status: "error",
    error_json: currentErrorJson,
  });

  deps.emitInstalledSource(updated);
  return updated;
};

export const reportWebviewBuildSuccess = async (
  deps: ReloadDeps,
  installName: string,
  webviewId: string,
  expectedSource?: ExpectedWebviewBuildSource,
) => {
  const existing = await deps.installedExtensionSourcesService.getByInstallName(installName);
  if (!existing) throw new Error(`Installed extension not found: ${installName}`);
  if (
    expectedSource &&
    (existing.source_path !== expectedSource.sourcePath ||
      (expectedSource.sourceHash !== undefined && existing.source_hash !== expectedSource.sourceHash))
  ) {
    return existing;
  }

  const currentError = existing.last_error_json;
  const shouldClear =
    currentError &&
    typeof currentError === "object" &&
    "code" in currentError &&
    currentError.code === "extension_webview_build_failed" &&
    "webviewId" in currentError &&
    currentError.webviewId === webviewId;

  const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
    loaded_revision: crypto.randomUUID(),
    ...(shouldClear ? { status: "loaded" as const, last_error_json: null } : {}),
  });
  if (!updated) throw new Error(`Installed extension not found: ${installName}`);

  deps.emitInstalledSource(updated);
  return updated;
};
