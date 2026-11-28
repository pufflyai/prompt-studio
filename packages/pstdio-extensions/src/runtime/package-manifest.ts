import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXTENSION_API_VERSION,
  parseExtensionApiDeclaration,
  supportsExtensionApiVersion,
} from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { parseProcessEnvironmentDeclaration } from "./process-environment-declaration";

const ID_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export const isRuntimeCliName = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);

export type ExtensionLoadScope = "user" | "repo";

export interface PackageManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  icon?: string;
  publisher: string;
  main: string;
  enginesPstdio: string;
  pstdio?: {
    scope?: ExtensionLoadScope;
    /** A CLI the host checks before provisioning a prebuilt harness's dependencies. */
    runtimeCli?: string;
    projectFiles?: { tracked: boolean };
    /** Host variable names the extension may ask the host to pass to the children it starts. */
    processEnvironment?: string[];
  };
  id: string;
}

export type ReadPackageManifestResult = {
  manifest: PackageManifest | null;
  entryPath: string | null;
  diagnostics: ExtensionDiagnostic[];
};

const isStringRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const requireField = (
  diagnostics: ExtensionDiagnostic[],
  packagePath: string,
  field: string,
  value: unknown,
): value is string => {
  if (typeof value === "string" && value.length > 0) return true;
  diagnostics.push(
    createDiagnostic({
      code: "extension_manifest_missing_field",
      message: `package.json is missing required field "${field}"`,
      sourcePath: packagePath,
    }),
  );
  return false;
};

const validateSegment = (diagnostics: ExtensionDiagnostic[], packagePath: string, field: string, value: string) => {
  if (ID_SEGMENT_PATTERN.test(value)) return true;
  diagnostics.push(
    createDiagnostic({
      code: "extension_manifest_invalid_value",
      message: `${field} "${value}" does not match ${ID_SEGMENT_PATTERN}`,
      sourcePath: packagePath,
    }),
  );
  return false;
};

const validateSemver = (diagnostics: ExtensionDiagnostic[], packagePath: string, field: string, value: string) => {
  if (SEMVER_PATTERN.test(value)) return true;
  diagnostics.push(
    createDiagnostic({
      code: "extension_manifest_invalid_value",
      message: `${field} "${value}" is not a valid semver`,
      sourcePath: packagePath,
    }),
  );
  return false;
};

const validatePstdioMetadata = (
  diagnostics: ExtensionDiagnostic[],
  packagePath: string,
  value: unknown,
): PackageManifest["pstdio"] | null => {
  if (value === undefined) return undefined;
  if (!isStringRecord(value)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: "pstdio must be an object",
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const scope = value.scope;
  if (scope !== undefined && scope !== "user" && scope !== "repo") {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `pstdio.scope "${String(scope)}" must be "user" or "repo"`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const runtimeCli = value.runtimeCli;
  if (runtimeCli !== undefined && !isRuntimeCliName(runtimeCli)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: "pstdio.runtimeCli must be an executable name without a path or arguments",
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const projectFiles = value.projectFiles;
  if (projectFiles !== undefined) {
    if (!isStringRecord(projectFiles) || typeof projectFiles.tracked !== "boolean") {
      diagnostics.push(
        createDiagnostic({
          code: "extension_manifest_invalid_value",
          message: "pstdio.projectFiles.tracked must be a boolean",
          sourcePath: packagePath,
        }),
      );
      return null;
    }
  }

  // Every backend runs in its worker. `backendRuntime` chose that before it became the only
  // runtime, so packages that still carry it load unchanged.
  const processEnvironment =
    value.processEnvironment === undefined ? undefined : parseProcessEnvironmentDeclaration(value.processEnvironment);
  if (processEnvironment?.error) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: processEnvironment.error,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  if (scope === undefined && runtimeCli === undefined && projectFiles === undefined && !processEnvironment)
    return undefined;
  return {
    ...(scope ? { scope } : {}),
    ...(runtimeCli ? { runtimeCli } : {}),
    ...(processEnvironment ? { processEnvironment: processEnvironment.names } : {}),
    ...(projectFiles ? { projectFiles: { tracked: projectFiles.tracked as boolean } } : {}),
  };
};

/**
 * Who compared `engines.pstdio` with `EXTENSION_API_VERSION`: the host that loads the
 * extension, or the pst that checks a source folder without a host.
 */
export type ExtensionApiProvider = "host" | "pst";

// The pst running a source check can be a different release than the user's host.
const PST_CHECK_NOTE =
  "If your Prompt Studio host runs a different release than this pst, use the pst from that release, or install the extension and run `pst extensions check` in the linked project so the host checks it.";

const apiVersionRepair = (targetsOlderApi: boolean, upgradable: boolean) => {
  if (!targetsOlderApi) return "Update Prompt Studio, or use a build of the extension for this host.";
  if (upgradable) return "Upgrade the extension to its build for this host.";
  return `Fix the extension source: make it work with extension API ${EXTENSION_API_VERSION}, then add "^${EXTENSION_API_VERSION}" to engines.pstdio in its package.json.`;
};

/**
 * `upgradable` means the host can replace this source with a release built for it. Any other
 * source is owned by whoever wrote it, so the advice is to fix the source itself.
 */
export const getExtensionApiVersionError = (
  name: string,
  declared: string,
  options: { upgradable?: boolean; apiProvider?: ExtensionApiProvider } = {},
) => {
  const minimums = parseExtensionApiDeclaration(declared);
  // Catalog builds that predate caret ranges are fixed by upgrading, not by editing their manifest.
  if (!minimums && options.upgradable) {
    return `Extension "${name}" declares engines.pstdio "${declared}", which this host no longer accepts. ${apiVersionRepair(true, true)}`;
  }
  if (!minimums) {
    return `Extension "${name}" declares engines.pstdio "${declared}". Declare caret ranges separated by "||", such as "^${EXTENSION_API_VERSION}".`;
  }
  if (supportsExtensionApiVersion(declared, EXTENSION_API_VERSION)) return null;

  // No term matched, so a term whose minimum is below the host must be on an older breaking line.
  const targetsOlderApi = minimums.every((minimum) => Bun.semver.order(minimum, EXTENSION_API_VERSION) < 0);
  if (options.apiProvider === "pst") {
    const repair = targetsOlderApi ? apiVersionRepair(true, false) : "Update pst to a release with this extension API.";
    return `Extension "${name}" targets extension API ${declared} but this pst provides ${EXTENSION_API_VERSION}. ${repair} ${PST_CHECK_NOTE}`;
  }
  return `Extension "${name}" targets extension API ${declared} but this host provides ${EXTENSION_API_VERSION}. ${apiVersionRepair(targetsOlderApi, options.upgradable === true)}`;
};

export const readPackageManifestMetadata = (packageDir: string): ReadPackageManifestResult => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const packagePath = join(packageDir, "package.json");

  if (!existsSync(packagePath)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_not_found",
        message: `package.json is missing in ${packageDir}`,
        sourcePath: packageDir,
      }),
    );
    return { manifest: null, entryPath: null, diagnostics };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_json",
        message: `package.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
        sourcePath: packagePath,
      }),
    );
    return { manifest: null, entryPath: null, diagnostics };
  }

  if (!isStringRecord(raw)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: "package.json must be a JSON object",
        sourcePath: packagePath,
      }),
    );
    return { manifest: null, entryPath: null, diagnostics };
  }

  const name = raw.name;
  const version = raw.version;
  const publisher = raw.publisher;
  const main = raw.main;
  const engines = isStringRecord(raw.engines) ? raw.engines : undefined;
  const enginesPstdio = engines?.pstdio;
  const pstdio = validatePstdioMetadata(diagnostics, packagePath, raw.pstdio);

  const hasName = requireField(diagnostics, packagePath, "name", name);
  const hasVersion = requireField(diagnostics, packagePath, "version", version);
  const hasPublisher = requireField(diagnostics, packagePath, "publisher", publisher);
  const hasMain = requireField(diagnostics, packagePath, "main", main);
  const hasEnginesPstdio = requireField(diagnostics, packagePath, "engines.pstdio", enginesPstdio);

  const ok =
    hasName &&
    validateSegment(diagnostics, packagePath, "name", name) &&
    hasVersion &&
    validateSemver(diagnostics, packagePath, "version", version) &&
    hasPublisher &&
    validateSegment(diagnostics, packagePath, "publisher", publisher) &&
    hasMain &&
    hasEnginesPstdio &&
    pstdio !== null;

  if (!ok) return { manifest: null, entryPath: null, diagnostics };

  let icon = optionalString(raw.icon);
  try {
    readExtensionIcon(packageDir, icon);
  } catch (error) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        severity: "warning",
        message: `icon is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        sourcePath: packagePath,
      }),
    );
    icon = undefined;
  }

  const entryPath = resolveEntry(diagnostics, packagePath, packageDir, main as string);
  if (!entryPath) return { manifest: null, entryPath: null, diagnostics };

  const manifest: PackageManifest = {
    name: name as string,
    version: version as string,
    displayName: optionalString(raw.displayName),
    description: optionalString(raw.description),
    icon,
    publisher: publisher as string,
    main: main as string,
    enginesPstdio: enginesPstdio as string,
    ...(pstdio ? { pstdio } : {}),
    id: `${publisher as string}.${name as string}`,
  };

  return { manifest, entryPath, diagnostics };
};

export const readPackageManifest = (
  packageDir: string,
  options: { apiProvider?: ExtensionApiProvider } = {},
): ReadPackageManifestResult => {
  const result = readPackageManifestMetadata(packageDir);
  if (!result.manifest) return result;

  const versionError = getExtensionApiVersionError(result.manifest.name, result.manifest.enginesPstdio, options);
  if (!versionError) return result;

  return {
    manifest: null,
    entryPath: null,
    diagnostics: [
      ...result.diagnostics,
      createDiagnostic({
        code: "extension_manifest_unsupported_api_version",
        message: versionError,
        sourcePath: join(packageDir, "package.json"),
      }),
    ],
  };
};

import { readExtensionIcon } from "./extension-icon";
import { resolveEntry } from "./package-entry";

/** Preserve observable identity without inspecting code the host cannot run. */
export const unavailableManifestLoadKey = (packagePath: string) => {
  const { manifest, entryPath, diagnostics } = readPackageManifestMetadata(packagePath);
  if (manifest && entryPath && !getExtensionApiVersionError(manifest.name, manifest.enginesPstdio)) return;
  return `manifest-${createHash("sha256").update(JSON.stringify({ manifest, diagnostics })).digest("hex")}`;
};
