import { describe, expect, test } from "bun:test";
import type { PreferenceValue } from "./preference-registry";
import { createPreferenceRegistry } from "./preference-registry";

describe("createPreferenceRegistry", () => {
  test("registers preference schemas and resolves scoped values by precedence", () => {
    const preferences = createPreferenceRegistry();

    preferences.registerSchema({
      properties: {
        "workbench.defaultOpenArea": {
          type: "string",
          enum: ["main", "main-right", "secondary"],
          default: "main",
          scope: "user",
          description: "Default area for newly opened resources.",
        },
      },
    });

    preferences.setValue("workbench.defaultOpenArea", "main-right", { scope: "user" });
    preferences.setValue("workbench.defaultOpenArea", "secondary", { scope: "workspace", scopeId: "w1" });

    expect(preferences.getValue("workbench.defaultOpenArea")).toBe("main-right");
    expect(preferences.getValue("workbench.defaultOpenArea", { scope: "workspace", scopeId: "w1" })).toBe("secondary");
    expect(preferences.getSchema("workbench.defaultOpenArea")).toMatchObject({ default: "main" });
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
        "workbench.defaultOpenArea": {
          type: "string",
          default: "main",
          scope: "user",
        },
      },
    });

    preferences.setValue("workbench.defaultOpenArea", "main-right", { scope: "user" });

    expect(storedValues.get("workbench.defaultOpenArea:user:")).toBe("main-right");
    expect(preferences.getValue("workbench.defaultOpenArea")).toBe("main-right");
  });
});
