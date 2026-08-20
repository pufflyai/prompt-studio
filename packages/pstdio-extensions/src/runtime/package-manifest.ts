import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";

const ID_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export type ExtensionLoadScope = "user" | "repo";

export interface PackageManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  publisher: string;
  main: string;
  enginesPstdio: string;
  pstdio?: {
    scope?: ExtensionLoadScope;
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
  if (scope === undefined) return undefined;
  if (scope === "user" || scope === "repo") return { scope };

  diagnostics.push(
    createDiagnostic({
      code: "extension_manifest_invalid_value",
      message: `pstdio.scope "${String(scope)}" must be "user" or "repo"`,
      sourcePath: packagePath,
    }),
  );
  return null;
};

const resolveEntry = (diagnostics: ExtensionDiagnostic[], packagePath: string, packageDir: string, main: string) => {
  if (isAbsolute(main)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" must be a relative path`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const resolved = resolve(packageDir, main);
  const rel = relative(packageDir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" resolves outside the package directory`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  if (!existsSync(resolved)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_entry_not_found",
        message: `main "${main}" resolves to ${resolved} which does not exist`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  const realPackageDir = realpathSync(packageDir);
  const realResolved = realpathSync(resolved);
  const realRel = relative(realPackageDir, realResolved);
  if (realRel.startsWith("..") || isAbsolute(realRel)) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" resolves outside the package directory`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  if (!statSync(resolved).isFile()) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_invalid_value",
        message: `main "${main}" must point to a file`,
        sourcePath: packagePath,
      }),
    );
    return null;
  }

  return resolved;
};

// An extension declares the exact API version it was built against. Ranges are refused:
// `^1.0.0-alpha.1` also matches `1.0.0-alpha.2` under semver, so a range would wave through
// every alpha bump while looking like a gate.
const isVersionRange = (declared: string) => /^[\^~><=*]/.test(declared);

const apiVersionError = (name: string, declared: string) => {
  if (declared === EXTENSION_API_VERSION) return null;

  if (isVersionRange(declared)) {
    return `Extension "${name}" declares engines.pstdio "${declared}". While the extension API is in alpha it must be the exact version "${EXTENSION_API_VERSION}", not a range.`;
  }

  return `Extension "${name}" targets extension API ${declared} but this host provides ${EXTENSION_API_VERSION}. Update Prompt Studio, or install a build of the extension for this version.`;
};

export const readPackageManifest = (packageDir: string): ReadPackageManifestResult => {
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

  const entryPath = resolveEntry(diagnostics, packagePath, packageDir, main as string);
  if (!entryPath) return { manifest: null, entryPath: null, diagnostics };

  const versionError = apiVersionError(name as string, enginesPstdio as string);
  if (versionError) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_unsupported_api_version",
        message: versionError,
        sourcePath: packagePath,
      }),
    );
    return { manifest: null, entryPath: null, diagnostics };
  }

  const displayName = typeof raw.displayName === "string" && raw.displayName.length > 0 ? raw.displayName : undefined;
  const description = typeof raw.description === "string" && raw.description.length > 0 ? raw.description : undefined;

  const manifest: PackageManifest = {
    name: name as string,
    version: version as string,
    displayName,
    description,
    publisher: publisher as string,
    main: main as string,
    enginesPstdio: enginesPstdio as string,
    ...(pstdio ? { pstdio } : {}),
    id: `${publisher as string}.${name as string}`,
  };

  return { manifest, entryPath, diagnostics };
};
