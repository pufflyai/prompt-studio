import { defineRecipe } from "@chakra-ui/react";

const interactiveBorderColor = "border.accent-light";

export const inputRecipe = defineRecipe({
  base: {
    px: "sm",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    bg: "bg",
    color: "fg",
    border: "1px solid",
    borderColor: "border",
    outline: "none",
    boxShadow: "none",
    "--focus-color": "var(--chakra-colors-border-accent-light)",
    "--focus-ring-style": "none",
    _hover: { borderColor: interactiveBorderColor },
    _active: { borderColor: interactiveBorderColor },
    _focus: { borderColor: interactiveBorderColor, outline: "none", boxShadow: "none" },
    _focusVisible: { borderColor: interactiveBorderColor, outline: "none", boxShadow: "none" },
    _placeholder: { color: "fg.subtle" },
    "&:is(:hover, [data-hover])": {
      borderColor: interactiveBorderColor,
    },
    "&:is(:active, [data-active])": {
      borderColor: interactiveBorderColor,
    },
  },
  variants: {
    variant: {
      outline: {
        bg: "bg",
        border: "1px solid",
        borderColor: "border",
        outline: "none",
        boxShadow: "none",
        "--focus-color": "var(--chakra-colors-border-accent-light)",
        "--focus-ring-style": "none",
        _hover: { borderColor: interactiveBorderColor },
        _active: { borderColor: interactiveBorderColor },
        _focus: { borderColor: interactiveBorderColor, outline: "none", boxShadow: "none" },
        _focusVisible: { borderColor: interactiveBorderColor, outline: "none", boxShadow: "none" },
        "&:is(:hover, [data-hover])": {
          borderColor: interactiveBorderColor,
        },
        "&:is(:active, [data-active])": {
          borderColor: interactiveBorderColor,
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
