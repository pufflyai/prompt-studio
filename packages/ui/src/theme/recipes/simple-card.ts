import { defineRecipe } from "@chakra-ui/react";

export const simpleCardRecipe = defineRecipe({
  base: {
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "xs",
    bg: "bg",
    "--simple-card-body-padding": "{spacing.md}",
  },
  variants: {
    variant: {
      outline: {},
      action: {
        "--simple-card-body-padding": "{spacing.xs}",
        borderWidth: "0",
        borderColor: "transparent",
        bg: "bg.muted",
        cursor: "pointer",
        textAlign: "left",
        focusVisibleRing: "outside",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
    },
  },
  defaultVariants: { variant: "outline" },
});
