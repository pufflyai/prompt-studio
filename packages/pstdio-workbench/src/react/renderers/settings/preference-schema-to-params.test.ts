import { describe, expect, test } from "bun:test";
import type { PreferencePropertySchema } from "../../../core";
import { paramValueToPreference, preferenceSchemaToParams } from "./preference-schema-to-params";

const schema = (overrides: Partial<PreferencePropertySchema> & Pick<PreferencePropertySchema, "type">) =>
  ({ scope: "user", ...overrides }) satisfies PreferencePropertySchema;

describe("preferenceSchemaToParams", () => {
  test("maps number, string, string-enum and boolean schemas to param-editor params", () => {
    const params = preferenceSchemaToParams([
      { name: "editor.fontSize", label: "Font size", schema: schema({ type: "number", default: 13 }), value: 15 },
      { name: "editor.fontFamily", label: "Font family", schema: schema({ type: "string", default: "Inter" }) },
      {
        name: "appearance.theme",
        label: "Theme",
        schema: schema({ type: "string", enum: ["system", "light", "dark"], default: "system" }),
      },
      { name: "appearance.badges", label: "Badges", schema: schema({ type: "boolean", default: true }) },
    ]);

    expect(params).toEqual([
      { id: "editor.fontSize", name: "Font size", type: "number", description: undefined, defaultValue: 15 },
      {
        id: "editor.fontFamily",
        name: "Font family",
        type: "text",
        description: undefined,
        defaultValue: "Inter",
        singleLine: true,
      },
      {
        id: "appearance.theme",
        name: "Theme",
        type: "selection",
        description: undefined,
        defaultValue: "system",
        options: [
          { id: "system", name: "System" },
          { id: "light", name: "Light" },
          { id: "dark", name: "Dark" },
        ],
      },
      {
        id: "appearance.badges",
        name: "Badges",
        type: "selection",
        description: undefined,
        defaultValue: "true",
        options: [
          { id: "true", name: "On" },
          { id: "false", name: "Off" },
        ],
      },
    ]);
  });

  test("maps enum arrays to a multi-select param", () => {
    const [param] = preferenceSchemaToParams([
      {
        name: "editor.rulers",
        label: "Rulers",
        schema: schema({ type: "array", enum: ["80", "100", "120"], default: ["80"], scope: "workspace" }),
        value: ["80", "120"],
      },
    ]);

    expect(param).toMatchObject({
      id: "editor.rulers",
      type: "selection",
      multiSelect: true,
      defaultValue: ["80", "120"],
    });
  });

  test("falls back to a humanized label and skips schemas with no param-editor control", () => {
    const params = preferenceSchemaToParams([
      { name: "workbench.editor.wordWrap", schema: schema({ type: "boolean" }) },
      { name: "workbench.layout", schema: schema({ type: "object" }) },
      { name: "workbench.openEditors", schema: schema({ type: "array" }) },
    ]);

    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({ id: "workbench.editor.wordWrap", name: "Word Wrap" });
  });
});

describe("paramValueToPreference", () => {
  test("coerces param-editor values back to typed preference values", () => {
    expect(paramValueToPreference(schema({ type: "boolean" }), "true")).toBe(true);
    expect(paramValueToPreference(schema({ type: "boolean" }), "false")).toBe(false);
    expect(paramValueToPreference(schema({ type: "number" }), 12)).toBe(12);
    expect(paramValueToPreference(schema({ type: "string", enum: ["a", "b"] }), "b")).toBe("b");
    expect(paramValueToPreference(schema({ type: "array", enum: ["80", "100"] }), ["80", "100"])).toEqual([
      "80",
      "100",
    ]);
  });
});
