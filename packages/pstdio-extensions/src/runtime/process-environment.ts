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

const isSafeHostVariable = (name: string) =>
  SAFE_HOST_VARIABLES.includes(name as (typeof SAFE_HOST_VARIABLES)[number]) || name.startsWith("LC_");

export const createExtensionProcessEnvironment = (
  hostEnv: NodeJS.ProcessEnv = process.env,
  explicitEnv: NodeJS.ProcessEnv = {},
) => {
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(hostEnv)) {
    if (value !== undefined && isSafeHostVariable(name)) env[name] = value;
  }
  for (const [name, value] of Object.entries(explicitEnv)) {
    if (value !== undefined) env[name] = value;
  }

  return env;
};
