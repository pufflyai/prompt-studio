import { describe, expect, test } from "bun:test";
import { tokenEditorPresets } from "./token-editor-data";

const findPreset = (id: string) => {
  const preset = tokenEditorPresets.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Missing token editor preset: ${id}`);
  return preset;
};

describe("tokenEditorPresets", () => {
  test("uses the canonical pst light defaults", () => {
    const values = findPreset("pst-light").values;

    expect(values).toMatchObject({
      "colors.bg.muted": "#F0F5F1",
      "colors.bg.subtle": "#F9FBFA",
      "colors.bg.hover": "#EDF2EE",
      "colors.bg.active": "#E7EEE9",
      "colors.border": "#EAF0EB",
      "colors.border.subtle": "#EDF2EE",
    });
  });

  test("uses the canonical pst dark defaults", () => {
    const values = findPreset("pst-dark").values;

    expect(values).toMatchObject({
      "colors.bg": "#07090E",
      "colors.bg.muted": "#171A22",
      "colors.bg.subtle": "#0E1016",
      "colors.bg.hover": "#1E212A",
      "colors.bg.active": "#252932",
      "colors.bg.code": "#10131A",
      "colors.bg.emphasized": "#1D242E",
    });

    expect(
      Object.fromEntries(
        Object.entries(values).filter(([id]) => id === "colors.border" || id === "colors.border.subtle"),
      ),
    ).toEqual({
      "colors.border": "#2E333F",
      "colors.border.subtle": "#1A1E26",
    });
  });
});
