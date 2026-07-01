import { defineRecipe } from "@chakra-ui/react";

export const inputRecipe = defineRecipe({
  base: {
    px: "sm",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    bg: "bg",
    color: "fg",
    border: "1px solid",
    borderColor: "border",
    _hover: { borderColor: "border" },
    _active: { borderColor: "border" },
    _focus: { borderColor: "border.accent" },
    _focusVisible: { borderColor: "border.accent", outline: "none" },
    _placeholder: { color: "fg.subtle" },
    "&:is(:hover, [data-hover])": {
      borderColor: "border",
    },
    "&:is(:active, [data-active])": {
      borderColor: "border",
    },
  },
  variants: {
    variant: {
      outline: {
        bg: "bg",
        border: "1px solid",
        borderColor: "border",
        focusVisibleRing: "inside",
        _hover: { borderColor: "border" },
        _active: { borderColor: "border" },
        _focus: { borderColor: "border.accent" },
        _focusVisible: { borderColor: "border.accent", outline: "none" },
        "&:is(:hover, [data-hover])": {
          borderColor: "border",
        },
        "&:is(:active, [data-active])": {
          borderColor: "border",
        },
      },
    },
    size: {
      "2xs": {
        h: "1.5rem",
        px: "2xs",
        textStyle: "label/XS",
      },
      xs: {
        h: "1.75rem",
        px: "xs",
        textStyle: "label/XS",
      },
      sm: {
        h: "2rem",
        px: "sm",
        textStyle: "label/S/regular",
      },
      md: {
        h: "2.5rem",
        px: "sm",
        textStyle: "label/M/regular",
      },
      lg: {
        h: "3rem",
        px: "md",
        textStyle: "label/M/regular",
      },
    },
  },
  defaultVariants: {
    size: "sm",
    variant: "outline",
  },
});
