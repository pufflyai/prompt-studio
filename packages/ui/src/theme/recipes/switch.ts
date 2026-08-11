import { defineSlotRecipe } from "@chakra-ui/react";
import { switchAnatomy } from "@chakra-ui/react/anatomy";

export const switchSlotRecipe = defineSlotRecipe({
  slots: switchAnatomy.keys(),
  base: {
    control: {
      alignItems: "center",
      bg: "bg.muted",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "md",
      color: "fg",
      boxShadow: "none",
      transition: "border-color 0.2s ease-in-out, background-color 0.2s ease-in-out",
      _hover: { borderColor: "border.accent-light" },
      _active: { borderColor: "border.accent-light" },
      _focusVisible: {
        borderColor: "border.accent-light",
        outline: "none",
        boxShadow: "none",
      },
      _checked: {
        bg: "bg.inverted",
        borderColor: "bg.inverted",
        _hover: { borderColor: "bg.inverted" },
        _active: { borderColor: "bg.inverted" },
      },
    },
    thumb: {
      bg: "bg",
      borderColor: "border",
      borderRadius: "full",
      _checked: {
        bg: "fg.inverted",
      },
    },
  },
  variants: {
    variant: {
      solid: {
        control: {
          // The switch track radius is "md" — never "full", which breaks the look.
          // Chakra's default solid variant pins "full", so the design radius must
          // be restated here for the merge to keep it.
          borderRadius: "md",
          _checked: {
            bg: "bg.inverted",
            borderColor: "bg.inverted",
          },
        },
        thumb: {
          _checked: {
            bg: "fg.inverted",
          },
        },
      },
    },
  },
});
