const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// The host's own runtime namespace and package registry credentials never reach an extension's child,
// whatever its manifest asks for. Windows matches names case-insensitively, so compare in upper case.
const RESERVED_NAMES = ["BUN_AUTH_TOKEN", "NODE_AUTH_TOKEN", "NPM_AUTH_TOKEN", "NPM_TOKEN"];
const RESERVED_PREFIXES = ["PSTDIO_", "NPM_CONFIG_"];

export const isReservedProcessEnvironmentName = (name: string) => {
  const upper = name.toUpperCase();
  return RESERVED_NAMES.includes(upper) || RESERVED_PREFIXES.some((prefix) => upper.startsWith(prefix));
};

/** Validates `pstdio.processEnvironment`: unique, exact variable names outside the reserved set. */
export const parseProcessEnvironmentDeclaration = (value: unknown) => {
  if (!Array.isArray(value)) return { error: "pstdio.processEnvironment must be an array of variable names" };
  const names: string[] = [];
  for (const name of value) {
    if (typeof name !== "string" || !NAME_PATTERN.test(name))
      return { error: `pstdio.processEnvironment entry ${JSON.stringify(name)} must be an exact variable name` };
    if (names.includes(name)) return { error: `pstdio.processEnvironment lists ${name} more than once` };
    if (isReservedProcessEnvironmentName(name))
      return { error: `pstdio.processEnvironment cannot request ${name}: the name is reserved for Prompt Studio` };
    names.push(name);
  }
  return { names };
};
