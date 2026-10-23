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
        transition: "background-color 0s {durations.hover-exit-delay}",
        _hover: { bg: "bg.hover", transitionDelay: "0s" },
        _active: { bg: "bg.active", transitionDelay: "0s" },
      },
    },
  },
  defaultVariants: { variant: "outline" },
});
