type ErrorChainEntry = {
  name?: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
};

const KNOWN_EXTRA_KEYS = [
  "code",
  "detail",
  "hint",
  "constraint",
  "table",
  "column",
  "schema",
  "where",
  "query",
  "params",
];

const collectExtra = (err: unknown) => {
  if (typeof err !== "object" || err === null) return undefined;
  const extra: Record<string, unknown> = {};
  for (const key of KNOWN_EXTRA_KEYS) {
    const value = (err as Record<string, unknown>)[key];
    if (value !== undefined) extra[key] = value;
  }
  return Object.keys(extra).length > 0 ? extra : undefined;
};

export const flattenErrorChain = (err: unknown, depth = 5) => {
  const chain: ErrorChainEntry[] = [];
  let current: unknown = err;
  let remaining = depth;

  while (current && remaining > 0) {
    if (current instanceof Error) {
      chain.push({
        name: current.name,
        message: current.message,
        stack: current.stack,
        extra: collectExtra(current),
      });
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      chain.push({ message: String(current), extra: collectExtra(current) });
      current = undefined;
    }
    remaining -= 1;
  }

  return chain;
};
