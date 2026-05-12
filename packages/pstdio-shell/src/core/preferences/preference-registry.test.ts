import { describe, expect, test } from "bun:test";
import { createPreferenceRegistry } from "./preference-registry";

describe("createPreferenceRegistry", () => {
  test("registers preference schemas and resolves scoped values by precedence", () => {
    const preferences = createPreferenceRegistry();

    preferences.registerSchema({
      properties: {
        "shell.defaultOpenArea": {
          type: "string",
          enum: ["main", "right", "bottom"],
          default: "main",
          scope: "user",
          description: "Default area for newly opened resources.",
        },
      },
    });

    preferences.setValue("shell.defaultOpenArea", "right", { scope: "user" });
    preferences.setValue("shell.defaultOpenArea", "bottom", { scope: "workspace", scopeId: "w1" });

    expect(preferences.getValue("shell.defaultOpenArea")).toBe("right");
    expect(preferences.getValue("shell.defaultOpenArea", { scope: "workspace", scopeId: "w1" })).toBe("bottom");
    expect(preferences.getSchema("shell.defaultOpenArea")).toMatchObject({ default: "main" });
  });
});
