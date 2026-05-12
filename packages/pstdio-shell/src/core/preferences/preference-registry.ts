import type { ContributionMetadata } from "../contributions/metadata";
import { createDisposable } from "../disposable";

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

const valueKey = (name: string, scope: PreferenceScopeRef) => `${name}:${scope.scope}:${scope.scopeId ?? ""}`;

export const createPreferenceRegistry = () => {
  const schemas = new Map<string, PreferencePropertySchema & { ownerId: string; source: string }>();
  const values = new Map<string, PreferenceValue>();

  return {
    registerSchema(schema: PreferenceSchemaContribution, metadata?: ContributionMetadata) {
      const registeredNames = Object.keys(schema.properties);

      for (const name of registeredNames) {
        if (schemas.has(name)) throw new Error(`Preference schema already registered: ${name}`);
        const property = schema.properties[name];
        if (property) {
          schemas.set(name, {
            ...property,
            ownerId: metadata?.ownerId ?? metadata?.source ?? "shell",
            source: metadata?.source ?? "shell",
          });
        }
      }

      return createDisposable(() => {
        for (const name of registeredNames) schemas.delete(name);
      });
    },

    getSchema(name: string) {
      return schemas.get(name);
    },

    setValue(name: string, value: PreferenceValue, scope: PreferenceScopeRef) {
      if (!schemas.has(name)) throw new Error(`Preference schema not registered: ${name}`);
      values.set(valueKey(name, scope), value);
    },

    getValue(name: string, scope?: PreferenceScopeRef) {
      if (scope) {
        const scoped = values.get(valueKey(name, scope));
        if (scoped !== undefined) return scoped;
      }

      const userValue = values.get(valueKey(name, { scope: "user" }));
      if (userValue !== undefined) return userValue;

      return schemas.get(name)?.default;
    },
  };
};

export type PreferenceRegistry = ReturnType<typeof createPreferenceRegistry>;
