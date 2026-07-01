import { describe, expect, test } from "bun:test";
import { tokenEditorPresets } from "./token-editor-data";

const findPreset = (id: string) => {
  const preset = tokenEditorPresets.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Missing token editor preset: ${id}`);
  return preset;
};

describe("tokenEditorPresets", () => {
  test("uses the canonical pst dark defaults", () => {
    const values = findPreset("pst-dark").values;

    expect(values).toMatchObject({
      "colors.bg": "#07090E",
      "colors.bg.muted": "#0D1017",
      "colors.bg.subtle": "#0A0C12",
      "colors.bg.hover": "#141821",
      "colors.bg.active": "#191E28",
      "colors.bg.code": "#0D1017",
      "colors.bg.emphasized": "#1D242E",
    });

    expect(
      Object.fromEntries(
        Object.entries(values).filter(([id]) => id === "colors.border" || id === "colors.border.subtle"),
      ),
    ).toEqual({
      "colors.border": "#191E28",
      "colors.border.subtle": "#13161F",
    });
  });
});
