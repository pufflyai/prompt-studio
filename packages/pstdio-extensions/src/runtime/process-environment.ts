const SAFE_HOST_VARIABLES = [
  "BUN_INSTALL",
  "BUN_INSTALL_CACHE_DIR",
  "COLORTERM",
  "ComSpec",
  "FORCE_COLOR",
  "HOME",
  "LANG",
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

const createEnvironment = (
  hostEnv: NodeJS.ProcessEnv,
  explicitEnv: NodeJS.ProcessEnv,
  isAllowed: (name: string) => boolean,
  platform: NodeJS.Platform,
) => {
  const env: NodeJS.ProcessEnv = {};
  const canonicalNames = [...SAFE_HOST_VARIABLES, ...INSTALL_HOST_VARIABLES];
  const normalize = (name: string) =>
    platform === "win32"
      ? (canonicalNames.find((candidate) => candidate.toLowerCase() === name.toLowerCase()) ?? name.toUpperCase())
      : name;

  for (const [name, value] of Object.entries(hostEnv)) {
    const key = normalize(name);
    if (value !== undefined && isAllowed(key)) env[key] = value;
  }
  for (const [name, value] of Object.entries(explicitEnv)) {
    if (value !== undefined) env[normalize(name)] = value;
  }

  return env;
};

export const createExtensionProcessEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  explicitEnv: NodeJS.ProcessEnv = {},
  platform: NodeJS.Platform = process.platform,
) => createEnvironment(hostEnv, explicitEnv, isSafeHostVariable, platform);

export const createExtensionInstallEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) => createEnvironment(hostEnv, {}, isInstallHostVariable, platform);
