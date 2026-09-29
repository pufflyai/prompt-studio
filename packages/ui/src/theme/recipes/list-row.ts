import { defineRecipe } from "@chakra-ui/react";

export const listRowRecipe = defineRecipe({
  variants: {
    variant: {
      back: {
        height: "7",
        paddingInline: "sm",
        paddingBlock: "0",
        borderRadius: "xs",
        textStyle: "label/S/regular",
        _focusVisible: { outlineWidth: "2px", outlineStyle: "solid", outlineColor: "fg", outlineOffset: "-2px" },
      },
    },
  },
});
