import { defineRecipe } from "@chakra-ui/react";

export const buttonRecipe = defineRecipe({
  base: {
    borderRadius: "xs",
    transition: "all 0.1s ease-in-out",
    fontFamily: "label",
    fontWeight: "500",
    color: "fg",
    bg: "bg",
    borderColor: "border",
    _disabled: {
      opacity: 1,
      color: "fg.subtle",
      bg: "bg.muted",
      _hover: { bg: "bg.muted" },
    },
    _loading: {
      opacity: 1,
      color: "fg.subtle",
      bg: "bg.muted",
      _hover: { bg: "bg.muted" },
    },
  },
  variants: {
    variant: {
      "display-primary": {
        bg: "blacks.900",
        color: "fg.inverted",
        outline: "none",
        border: "none",
        _hover: { bg: "blacks.800" },
      },
      "display-outline": {
        bg: "transparent",
        color: "fg",
        border: "2px solid {fg}",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
      "display-ghost": {
        bg: "transparent",
        color: "fg",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
      "display-link": {
        bg: "transparent",
        color: "fg",
        border: "none",
        _hover: { textDecoration: "underline" },
        _active: { textDecoration: "underline" },
      },
      primary: {
        color: "fg.button.primary.default",
        bg: "bg.button.primary.default",
        border: "none",
        _hover: { bg: "bg.button.primary.hover" },
        _active: { bg: "bg.button.primary.pressed" },
      },
      destructive: {
        color: "blacks.50",
        bg: "red.500",
        border: "none",
        _hover: { bg: "red.600" },
        _active: { bg: "red.700" },
      },
      outline: {
        color: "fg",
        bg: "bg",
        border: "border",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _expanded: { bg: "bg.active" },
        _disabled: {
          opacity: 1,
          color: "fg.subtle",
          borderColor: "border",
        },
      },
      ghost: {
        color: "fg",
        bg: "transparent",
        border: "none",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _expanded: { bg: "bg.active" },
        _disabled: {
          bg: "transparent",
          _hover: { bg: "transparent" },
        },
      },
      subtle: {
        color: "fg",
        bg: "bg.muted",
        border: "1px solid {border}",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _expanded: { bg: "bg.active" },
        _disabled: {
          opacity: 1,
          color: "fg.subtle",
          bg: "bg.muted",
          borderColor: "border",
          _hover: { bg: "bg.muted" },
        },
      },
    },
    size: {
      "2xs": {
        px: "0.375rem",
        h: "1.5rem",
        minW: "1.5rem",
        textStyle: "label/XS",
        _icon: {
          width: "0.75rem",
          height: "0.75rem",
        },
      },
      xs: {
        px: "0.5rem",
        h: "1.75rem",
        minW: "1.75rem",
        textStyle: "label/XS",
        _icon: {
          width: "0.875rem",
          height: "0.875rem",
        },
      },
      "2xl": {
        px: "1.5rem",
        h: "3.5rem",
        textStyle: "label/L/medium",
      },
      lg: {
        px: "1rem",
        h: "3rem",
        textStyle: "label/M/medium",
      },
      md: {
        textStyle: "label/M/medium",
      },
      sm: {
        px: "0.5rem",
        h: "2rem",
        textStyle: "label/S/medium",
      },
    },
  },

  defaultVariants: { size: "sm", variant: "outline" },
});
