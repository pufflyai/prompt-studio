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
) => {
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(hostEnv)) {
    if (value !== undefined && isAllowed(name)) env[name] = value;
  }
  for (const [name, value] of Object.entries(explicitEnv)) {
    if (value !== undefined) env[name] = value;
  }

  return env;
};

export const createExtensionProcessEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  explicitEnv: NodeJS.ProcessEnv = {},
) => createEnvironment(hostEnv, explicitEnv, isSafeHostVariable);

export const createExtensionInstallEnvironment = (hostEnv: NodeJS.ProcessEnv = process.env) =>
  createEnvironment(hostEnv, {}, isInstallHostVariable);
