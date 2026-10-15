import type { ContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type PreferenceScope = "default" | "user" | "project" | "repo" | "workspace" | "extension" | "session";
export type PreferenceValue = boolean | number | string | string[] | number[] | boolean[] | Record<string, unknown>;

export interface PreferencePropertySchema {
  type: "boolean" | "number" | "string" | "array" | "object";
  enum?: PreferenceValue[];
  default?: PreferenceValue;
  scope: PreferenceScope;
  description?: string;
}

export interface PreferenceSchemaContribution {
  properties: Record<string, PreferencePropertySchema>;
}

export interface PreferenceScopeRef {
  scope: PreferenceScope;
  scopeId?: string;
}

export interface PreferencePersistenceAdapter {
  getValue(name: string, scope: PreferenceScopeRef): PreferenceValue | undefined;
  setValue(name: string, value: PreferenceValue, scope: PreferenceScopeRef): void | Promise<void>;
}

export interface CreatePreferenceRegistryInput {
  persistence?: PreferencePersistenceAdapter;
}

type RegisteredPreferenceSchema = PreferencePropertySchema & { ownerId: string; source: string };

export interface PreferenceRegistryStoreState {
  schemas: Record<string, RegisteredPreferenceSchema>;
}

export interface PreferenceValueAdapter {
  get(): PreferenceValue | undefined;
  set(value: PreferenceValue): void | Promise<void>;
}

export interface PreferenceRegistry {
  registerValueAdapter(name: string, adapter: PreferenceValueAdapter): Disposable;
  store: WorkbenchStore<PreferenceRegistryStoreState>;
  registerSchema(schema: PreferenceSchemaContribution, metadata?: ContributionMetadata): Disposable;
  getOwnedValue(ownerId: string, name: string, scope?: PreferenceScopeRef): PreferenceValue | undefined;
  setOwnedValue(ownerId: string, name: string, value: PreferenceValue, scope: PreferenceScopeRef): void | Promise<void>;
  getSchema(name: string): RegisteredPreferenceSchema | undefined;
  setValue(name: string, value: PreferenceValue, scope: PreferenceScopeRef): void | Promise<void>;
  getValue(name: string, scope?: PreferenceScopeRef): PreferenceValue | undefined;
}

const valueKey = (name: string, scope: PreferenceScopeRef) => `${name}:${scope.scope}:${scope.scopeId ?? ""}`;

const createMemoryPreferencePersistence = () => {
  const values = new Map<string, PreferenceValue>();

  return {
    getValue(name: string, scope: PreferenceScopeRef) {
      return values.get(valueKey(name, scope));
    },

    setValue(name: string, value: PreferenceValue, scope: PreferenceScopeRef) {
      values.set(valueKey(name, scope), value);
    },
  } satisfies PreferencePersistenceAdapter;
};

export const createPreferenceRegistry = (input: CreatePreferenceRegistryInput = {}): PreferenceRegistry => {
  const store = createWorkbenchStore<PreferenceRegistryStoreState>({
    name: "workbench.preferences",
    initialState: { schemas: {} },
  });
  const adapters = new Map<string, PreferenceValueAdapter>();
  const persistence = input.persistence ?? createMemoryPreferencePersistence();

  return {
    store,
    registerValueAdapter(name, adapter) {
      adapters.set(name, adapter);
      return createDisposable(() => {
        if (adapters.get(name) === adapter) adapters.delete(name);
      });
    },

    registerSchema(schema, metadata) {
      const registeredNames = Object.keys(schema.properties);
      const snapshot = store.getState();

      for (const name of registeredNames) {
        if (Object.hasOwn(snapshot.schemas, name)) throw new Error(`Preference schema already registered: ${name}`);
      }

      const additions: Record<string, RegisteredPreferenceSchema> = Object.create(null);
      for (const name of registeredNames) {
        const property = schema.properties[name];
        if (property) {
          additions[name] = {
            ...property,
            ownerId: metadata?.ownerId ?? "workbench.core",
            source: metadata?.source ?? "module",
          };
        }
      }

      store.setState({ schemas: { ...snapshot.schemas, ...additions } }, false, "registerSchema");

      return createDisposable(() => {
        const current = store.getState();
        const next = { ...current.schemas };
        for (const name of registeredNames) delete next[name];
        store.setState({ schemas: next }, false, "unregisterSchema");
      });
    },

    getOwnedValue(ownerId, name, scope) {
      const key = JSON.stringify([ownerId, name]);
      if (scope?.scope === "default") return undefined;
      const scoped = scope ? persistence.getValue(key, scope) : undefined;
      return scoped ?? persistence.getValue(key, { scope: "user" });
    },
    setOwnedValue(ownerId, name, value, scope) {
      if (scope.scope === "default") throw new Error("preference_scope_read_only");
      return persistence.setValue(JSON.stringify([ownerId, name]), value, scope);
    },
    getSchema(name) {
      const schemas = store.getState().schemas;
      return Object.hasOwn(schemas, name) ? schemas[name] : undefined;
    },

    setValue(name, value, scope) {
      if (!Object.hasOwn(store.getState().schemas, name)) throw new Error(`Preference schema not registered: ${name}`);
      const adapter = adapters.get(name);
      if (adapter) return adapter.set(value);
      return persistence.setValue(name, value, scope);
    },

    getValue(name, scope) {
      const adapter = adapters.get(name);
      if (adapter) return adapter.get();
      if (scope) {
        const scoped = persistence.getValue(name, scope);
        if (scoped !== undefined) return scoped;
      }

      const userValue = persistence.getValue(name, { scope: "user" });
      if (userValue !== undefined) return userValue;

      const schemas = store.getState().schemas;
      return Object.hasOwn(schemas, name) ? schemas[name]?.default : undefined;
    },
  };
};
