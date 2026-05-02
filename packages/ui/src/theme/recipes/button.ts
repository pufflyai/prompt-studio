import { defineRecipe } from "@chakra-ui/react";

export const buttonRecipe = defineRecipe({
  base: {
    borderRadius: "sm",
    transition: "all 0.1s ease-in-out",
    fontFamily: "label",
    fontWeight: "500",
    color: "fg",
    bg: "bg",
    borderColor: "border.muted",
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
        borderRadius: "xl",
        outline: "none",
        border: "none",
        _hover: { bg: "blacks.800" },
      },
      "display-outline": {
        bg: "transparent",
        color: "fg",
        borderRadius: "xl",
        border: "2px solid {fg}",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
      "display-ghost": {
        bg: "transparent",
        color: "fg",
        borderRadius: "xl",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
      "display-link": {
        bg: "transparent",
        color: "fg",
        border: "none",
        borderRadius: "xl",
        _hover: { textDecoration: "underline" },
        _active: { textDecoration: "underline" },
      },
      primary: {
        color: "blacks.1000",
        bg: "bg.button.primary.default",
        border: "none",
        _hover: { bg: "bg.button.primary.hover" },
        _active: { bg: "bg.button.primary.pressed" },
      },
      secondary: {
        color: "fg",
        bg: "bg",
        border: "2px solid border.muted",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _disabled: {
          opacity: 1,
          color: "fg.subtle",
          borderColor: "border.muted",
        },
      },
      outline: {
        color: "fg",
        bg: "bg",
        border: "border.muted",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _expanded: { bg: "bg.active" },
        _disabled: {
          opacity: 1,
          color: "fg.subtle",
          borderColor: "border.muted",
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
        bg: "bg.subtle",
        border: "none",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
        _expanded: { bg: "bg.active" },
        _disabled: {
          opacity: 1,
          color: "fg.subtle",
          bg: "bg.muted",
          _hover: { bg: "bg.muted" },
        },
      },
    },
    size: {
      xs: {
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

  defaultVariants: { size: "md", variant: "outline" },
});
