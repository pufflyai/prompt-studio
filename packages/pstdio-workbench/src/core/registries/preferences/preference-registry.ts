import type { ContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import {
  createWorkbenchStore,
  observeWorkbenchStoreTransitions,
  type WorkbenchStore,
} from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import { createPreferenceWrites } from "./preference-writes";

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
  /** Publish accepted writes, including writes made through other adapters or windows. */
  onDidChange?(listener: (change: PreferenceValueChange) => void): () => void;
}

export interface PreferenceValueChange {
  /** Omitted when the source cannot identify the affected values. */
  name?: string;
  scope?: PreferenceScopeRef;
}

export interface CreatePreferenceRegistryInput {
  persistence?: PreferencePersistenceAdapter;
}

type RegisteredPreferenceSchema = PreferencePropertySchema & { ownerId: string; source: string };

export interface PreferenceRegistryStoreState {
  schemas: Record<string, RegisteredPreferenceSchema>;
  valueChange?: PreferenceValueChange;
}

export interface PreferenceValueAdapter {
  get(): PreferenceValue | undefined;
  set(value: PreferenceValue): void | Promise<void>;
  /** Publish accepted source changes, including writes made through this adapter. */
  onDidChange?(listener: () => void): () => void;
}

export interface PreferenceRegistry {
  dispose?(): Promise<void>;
  onDidChangeValue(listener: (name: string) => void): Disposable;
  registerValueAdapter(name: string, adapter: PreferenceValueAdapter): Disposable;
  store: WorkbenchStore<PreferenceRegistryStoreState>;
  registerSchema(schema: PreferenceSchemaContribution, metadata?: ContributionMetadata): Disposable;
  getOwnedValue(ownerId: string, name: string, scope?: PreferenceScopeRef): PreferenceValue | undefined;
  setOwnedValue(ownerId: string, name: string, value: PreferenceValue, scope: PreferenceScopeRef): void | Promise<void>;
  getSchema(name: string): RegisteredPreferenceSchema | undefined;
  setValue(name: string, value: PreferenceValue, scope: PreferenceScopeRef): void | Promise<void>;
  getValue(name: string, scope?: PreferenceScopeRef): PreferenceValue | undefined;
}

const valueKey = (name: string, scope: PreferenceScopeRef) =>
  JSON.stringify([name, scope.scope, scope.scopeId ?? null]);

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
  const adapters = new Map<string, { adapter: PreferenceValueAdapter; stop?: () => void }>();
  const persistence: PreferencePersistenceAdapter = input.persistence ?? createMemoryPreferencePersistence();
  const writes = createPreferenceWrites();
  let disposed = false;
  const assertActive = () => {
    if (disposed) throw new Error("Preference registry is disposed");
  };
  const publish = (change: PreferenceValueChange) => {
    if (!disposed) store.setState({ ...store.getState(), valueChange: change }, false, "preferenceValueChanged");
  };
  const stopPersistence = persistence.onDidChange?.(publish);
  let disposal: Promise<void> | undefined;

  return {
    store,
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      store.dispose();
      disposal = writes.close().finally(() => {
        runWorkbenchEffect("preference persistence observation", () => stopPersistence?.());
        for (const record of adapters.values())
          runWorkbenchEffect("preference adapter observation", () => record.stop?.());
        adapters.clear();
      });
      return disposal;
    },
    onDidChangeValue(listener) {
      let previous = store.getState().valueChange;
      return createDisposable(
        observeWorkbenchStoreTransitions(store, () => {
          const { valueChange, schemas } = store.getState();
          if (!valueChange || valueChange === previous) return;
          previous = valueChange;
          const names = valueChange.name
            ? [valueChange.name]
            : [...new Set([...Object.keys(schemas), ...adapters.keys()])];
          for (const name of names) runWorkbenchEffect("preference change", () => listener(name));
        }),
      );
    },
    registerValueAdapter(name, adapter) {
      assertActive();
      adapters.get(name)?.stop?.();
      const record: { adapter: PreferenceValueAdapter; stop?: () => void } = { adapter };
      adapters.set(name, record);
      record.stop = adapter.onDidChange?.(() => {
        if (adapters.get(name) === record) publish({ name });
      });
      publish({ name });
      return createDisposable(() => {
        if (adapters.get(name) !== record) return;
        record.stop?.();
        adapters.delete(name);
        publish({ name });
      });
    },

    registerSchema(schema, metadata) {
      assertActive();
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
      scope = { ...scope };
      if (scope.scope === "default") throw new Error("preference_scope_read_only");
      const key = JSON.stringify([ownerId, name]);
      const accepted = structuredClone(value);
      return writes.write(
        valueKey(key, scope),
        () => persistence.setValue(key, accepted, scope),
        () => {
          if (!persistence.onDidChange) publish({ name: key, scope });
        },
      );
    },
    getSchema(name) {
      const schemas = store.getState().schemas;
      return Object.hasOwn(schemas, name) ? schemas[name] : undefined;
    },

    setValue(name, value, scope) {
      scope = { ...scope };
      if (!Object.hasOwn(store.getState().schemas, name)) throw new Error(`Preference schema not registered: ${name}`);
      const adapter = adapters.get(name)?.adapter;
      const accepted = structuredClone(value);
      return writes.write(
        valueKey(name, adapter ? { scope: "user" } : scope),
        () => (adapter ? adapter.set(accepted) : persistence.setValue(name, accepted, scope)),
        () => {
          if (!(adapter ? adapter.onDidChange : persistence.onDidChange)) publish({ name, scope });
        },
      );
    },

    getValue(name, scope) {
      const adapter = adapters.get(name)?.adapter;
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
