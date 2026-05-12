export type ContextKeyValue = boolean | number | string | undefined;

export const createContextKeyService = () => {
  const values = new Map<string, ContextKeyValue>();

  const readComparisonValue = (value: string) => value.replace(/^['"]|['"]$/g, "");

  const matchesTerm = (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length === 0) return true;

    const comparison = trimmed.match(/^([A-Za-z0-9_.-]+)\s*(==|!=)\s*(.+)$/);
    if (comparison) {
      const [, key, operator, rawValue] = comparison;
      const actual = values.get(key ?? "");
      const expected = readComparisonValue(rawValue ?? "");
      return operator === "==" ? String(actual) === expected : String(actual) !== expected;
    }

    if (trimmed.startsWith("!")) return !values.get(trimmed.slice(1));

    return Boolean(values.get(trimmed));
  };

  return {
    set(key: string, value: ContextKeyValue) {
      values.set(key, value);
    },

    get(key: string) {
      return values.get(key);
    },

    delete(key: string) {
      values.delete(key);
    },

    snapshot() {
      return Object.fromEntries(values);
    },

    matches(expression?: string) {
      if (!expression) return true;
      return expression.split("&&").every(matchesTerm);
    },
  };
};

export type ContextKeyService = ReturnType<typeof createContextKeyService>;
