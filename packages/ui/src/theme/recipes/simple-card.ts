import { defineRecipe } from "@chakra-ui/react";

export const simpleCardRecipe = defineRecipe({
  base: { borderWidth: "1px", borderColor: "border.subtle", borderRadius: "xs", bg: "bg" },
  variants: {
    variant: {
      outline: {},
      action: {
        borderColor: "transparent",
        bg: "bg.muted",
        cursor: "pointer",
        textAlign: "left",
        focusVisibleRing: "outside",
        transition: "background-color 0s {durations.hover-exit-delay}",
        _hover: { bg: "bg.hover", transitionDelay: "0s" },
        _active: { bg: "bg.active", transitionDelay: "0s" },
      },
    },
  },
  defaultVariants: { variant: "outline" },
});
