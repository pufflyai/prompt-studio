import { describe, expect, test } from "bun:test";
import { editableSlotRecipe } from "./editable";

describe("editableSlotRecipe", () => {
  test("defines size variants for editable text", () => {
    expect(editableSlotRecipe.variants?.size).toMatchObject({
      sm: {
        input: { lineHeight: "1.25rem", textStyle: "label/S/medium" },
        preview: { lineHeight: "1.25rem", textStyle: "label/S/medium" },
      },
      md: {
        input: { lineHeight: "1.375rem", textStyle: "label/M/medium" },
        preview: { lineHeight: "1.375rem", textStyle: "label/M/medium" },
      },
      lg: {
        input: { lineHeight: "1.5rem", textStyle: "label/L/medium" },
        preview: { lineHeight: "1.5rem", textStyle: "label/L/medium" },
      },
    });
  });
});
