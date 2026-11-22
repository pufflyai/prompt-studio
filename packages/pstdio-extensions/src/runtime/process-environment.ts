import { isReservedProcessEnvironmentName } from "./process-environment-declaration";

const SAFE_HOST_VARIABLES = [
  "APPDATA",
  "BUN_INSTALL",
  "BUN_INSTALL_CACHE_DIR",
  "COLORTERM",
  "ComSpec",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LOCALAPPDATA",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "PATHEXT",
  // Windows PowerShell can stall while rebuilding its default module search
  // path when this is absent. Like PATH, it contains runtime search directories.
  "PSModulePath",
  "SHELL",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USER",
  "USERPROFILE",
  "VOLTA_HOME",
  "WINDIR",
] as const;

const INSTALL_HOST_VARIABLES = [
  "ALL_PROXY",
  "BUN_CONFIG_MAX_HTTP_REQUESTS",
  "BUN_CONFIG_REGISTRY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NODE_AUTH_TOKEN",
  "NODE_EXTRA_CA_CERTS",
  "NO_PROXY",
  "NPM_AUTH_TOKEN",
  "NPM_CONFIG_CAFILE",
  "NPM_CONFIG_REGISTRY",
  "NPM_CONFIG_USERCONFIG",
  "NPM_TOKEN",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "all_proxy",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "npm_config_cafile",
  "npm_config_registry",
  "npm_config_userconfig",
] as const;

const isSafeHostVariable = (name: string) =>
  SAFE_HOST_VARIABLES.includes(name as (typeof SAFE_HOST_VARIABLES)[number]) || name.startsWith("LC_");

const isInstallHostVariable = (name: string) =>
  isSafeHostVariable(name) || INSTALL_HOST_VARIABLES.includes(name as (typeof INSTALL_HOST_VARIABLES)[number]);

const canonicalNames: readonly string[] = [...SAFE_HOST_VARIABLES, ...INSTALL_HOST_VARIABLES];

// Windows names are case-insensitive, so one spelling must win to avoid duplicate entries.
const normalizeName = (name: string, platform: NodeJS.Platform) =>
  platform === "win32"
    ? (canonicalNames.find((candidate) => candidate.toLowerCase() === name.toLowerCase()) ?? name.toUpperCase())
    : name;

const createEnvironment = (
  hostEnv: NodeJS.ProcessEnv,
  explicitEnv: NodeJS.ProcessEnv,
  isAllowed: (name: string) => boolean,
  platform: NodeJS.Platform,
) => {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(hostEnv)) {
    const key = normalizeName(name, platform);
    if (value !== undefined && isAllowed(key)) env[key] = value;
  }
  for (const [name, value] of Object.entries(explicitEnv)) {
    if (value !== undefined) env[normalizeName(name, platform)] = value;
  }

  return env;
};

/** A requested host variable the host cannot supply. The child is never started with a stand-in value. */
export class ProcessEnvironmentUnavailableError extends Error {
  readonly code = "process_environment_unavailable";
}

/**
 * The environment for a child an extension starts: runtime-safe host variables, the extension's
 * explicit `env`, and the host values named in `fromHost`. Callers authorize `fromHost` first;
 * the values go only into the returned environment, which belongs to the child.
 */
export const createExtensionProcessEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  explicitEnv: NodeJS.ProcessEnv = {},
  platform: NodeJS.Platform = process.platform,
  fromHost: readonly string[] = [],
) => {
  const requested = new Set(fromHost.map((name) => normalizeName(name, platform)));
  for (const name of fromHost) {
    if (isReservedProcessEnvironmentName(name))
      throw new Error(`envFromHost cannot include ${name}: the name is reserved for Prompt Studio.`);
  }
  for (const name of Object.keys(explicitEnv)) {
    if (requested.has(normalizeName(name, platform)))
      throw new Error(`env.${name} would replace the host value requested in envFromHost. Remove it from env.`);
  }

  const env = createEnvironment(hostEnv, explicitEnv, isSafeHostVariable, platform);
  for (const name of requested) {
    const value = Object.entries(hostEnv).find(([key]) => normalizeName(key, platform) === name)?.[1];
    if (value === undefined)
      throw new ProcessEnvironmentUnavailableError(
        `Environment variable ${name} is unavailable: set it in the environment that starts Prompt Studio, then restart Prompt Studio.`,
      );
    env[name] = value;
  }
  return env;
};

export const createExtensionInstallEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) => createEnvironment(hostEnv, {}, isInstallHostVariable, platform);
