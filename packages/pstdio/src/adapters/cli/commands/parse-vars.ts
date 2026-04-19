export const parseVars = (vars?: string[]) => {
  if (!vars?.length) return undefined;
  const result: Record<string, string> = {};
  for (const entry of vars) {
    const eq = entry.indexOf("=");
    if (eq === -1) throw new Error(`Invalid --var format: "${entry}". Expected key=value.`);
    result[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return result;
};
