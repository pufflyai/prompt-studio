import { describe, expect, test } from "bun:test";
import { buttonRecipe } from "./button";
import { colorPickerSlotRecipe } from "./color-picker";
import { dividerRecipe } from "./divider";
import { inputRecipe } from "./input";
import { numberInputSlotRecipe } from "./number-input";
import { textareaRecipe } from "./textarea";

describe("theme recipe border roles", () => {
  test("uses the default border role for inputs", () => {
    const restingInputBorder = {
      borderColor: "border",
      _hover: { borderColor: "border" },
      _focus: { borderColor: "border.accent" },
    };

    expect(inputRecipe.base).toMatchObject(restingInputBorder);
    expect(inputRecipe.variants?.variant?.outline).toMatchObject(restingInputBorder);
    expect(textareaRecipe.base).toMatchObject(restingInputBorder);
    expect(textareaRecipe.variants?.variant?.outline).toMatchObject(restingInputBorder);
    expect(colorPickerSlotRecipe.base?.control).toMatchObject({
      borderColor: "border",
      _hover: { borderColor: "border" },
      _focusWithin: { borderColor: "border.accent" },
    });
    expect(numberInputSlotRecipe.base?.root).toMatchObject({
      "--number-input-border-color": "var(--chakra-colors-border)",
      "&:is(:hover, [data-hover])": {
        "--number-input-border-color": "var(--chakra-colors-border)",
      },
      "&:focus-within": {
        "--number-input-border-color": "var(--chakra-colors-border-accent)",
      },
    });
  });

  test("uses the default border role for bordered buttons", () => {
    expect(buttonRecipe.base).toMatchObject({ borderColor: "border" });
    expect(buttonRecipe.variants?.variant?.outline).toMatchObject({ border: "border" });
    expect(buttonRecipe.variants?.variant?.subtle).toMatchObject({ border: "1px solid {border}" });
  });

  test("uses the subtle border role for separators", () => {
    expect(dividerRecipe.base).toMatchObject({ borderColor: "border.subtle" });
  });
});
