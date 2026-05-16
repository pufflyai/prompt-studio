import { createShellStore, type ShellStore } from "../store/shell-store";

export type ContextKeyValue = boolean | number | string | undefined;

export interface ContextKeyStoreState {
  values: Record<string, ContextKeyValue>;
}

export interface ContextKeyService {
  store: ShellStore<ContextKeyStoreState>;
  set(key: string, value: ContextKeyValue): void;
  get(key: string): ContextKeyValue;
  delete(key: string): void;
  snapshot(): Record<string, ContextKeyValue>;
  matches(expression?: string): boolean;
}

export const createContextKeyService = (): ContextKeyService => {
  const store = createShellStore<ContextKeyStoreState>({
    name: "shell.context",
    initialState: { values: {} },
  });

  const readComparisonValue = (value: string) => value.replace(/^['"]|['"]$/g, "");

  const matchesTerm = (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length === 0) return true;

    const values = store.getState().values;
    const comparison = trimmed.match(/^([A-Za-z0-9_.-]+)\s*(==|!=)\s*(.+)$/);
    if (comparison) {
      const [, key, operator, rawValue] = comparison;
      const actual = values[key ?? ""];
      const expected = readComparisonValue(rawValue ?? "");
      return operator === "==" ? String(actual) === expected : String(actual) !== expected;
    }

    if (trimmed.startsWith("!")) return !values[trimmed.slice(1)];

    return Boolean(values[trimmed]);
  };

  return {
    store,

    set(key, value) {
      const snapshot = store.getState();
      if (snapshot.values[key] === value) return;
      store.setState({ values: { ...snapshot.values, [key]: value } }, false, "setContextKey");
    },

    get(key) {
      return store.getState().values[key];
    },

    delete(key) {
      const snapshot = store.getState();
      if (!(key in snapshot.values)) return;
      const { [key]: _removed, ...rest } = snapshot.values;
      store.setState({ values: rest }, false, "deleteContextKey");
    },

    snapshot() {
      return { ...store.getState().values };
    },

    matches(expression) {
      if (!expression) return true;
      return expression.split("&&").every(matchesTerm);
    },
  };
};
