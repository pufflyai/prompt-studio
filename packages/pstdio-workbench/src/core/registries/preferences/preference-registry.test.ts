import { describe, expect, test } from "bun:test";
import type { PreferenceValue } from "./preference-registry";
import { createPreferenceRegistry } from "./preference-registry";

describe("createPreferenceRegistry", () => {
  test("registers preference schemas and resolves scoped values by precedence", () => {
    const preferences = createPreferenceRegistry();

    preferences.registerSchema({
      properties: {
        "workbench.defaultOpenRegion": {
          type: "string",
          enum: ["main", "main-right-menu", "secondary"],
          default: "main",
          scope: "user",
          description: "Default region for newly opened resources.",
        },
      },
    });

    preferences.setValue("workbench.defaultOpenRegion", "main-right-menu", { scope: "user" });
    preferences.setValue("workbench.defaultOpenRegion", "secondary", { scope: "workspace", scopeId: "w1" });

    expect(preferences.getValue("workbench.defaultOpenRegion")).toBe("main-right-menu");
    expect(preferences.getValue("workbench.defaultOpenRegion", { scope: "workspace", scopeId: "w1" })).toBe(
      "secondary",
    );
    expect(preferences.getSchema("workbench.defaultOpenRegion")).toMatchObject({ default: "main" });
  });

  test("uses injected persistence adapters for preference values", () => {
    const storedValues = new Map<string, PreferenceValue>();
    const preferences = createPreferenceRegistry({
      persistence: {
        getValue: (name, scope) => storedValues.get(`${name}:${scope.scope}:${scope.scopeId ?? ""}`),
        setValue: (name, value, scope) => {
          storedValues.set(`${name}:${scope.scope}:${scope.scopeId ?? ""}`, value);
        },
      },
    });

    preferences.registerSchema({
      properties: {
        "workbench.defaultOpenRegion": {
          type: "string",
          default: "main",
          scope: "user",
        },
      },
    });

    preferences.setValue("workbench.defaultOpenRegion", "main-right-menu", { scope: "user" });

    expect(storedValues.get("workbench.defaultOpenRegion:user:")).toBe("main-right-menu");
    expect(preferences.getValue("workbench.defaultOpenRegion")).toBe("main-right-menu");
  });
});
