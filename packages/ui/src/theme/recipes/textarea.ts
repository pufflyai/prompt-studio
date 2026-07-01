import { defineRecipe } from "@chakra-ui/react";

const interactiveBorderColor = "border.accent-light";

export const textareaRecipe = defineRecipe({
  base: {
    paddingX: "sm",
    paddingY: "xs",
    opacity: "1",
    outline: "none",
    boxShadow: "none",
    color: "fg",
    border: "1px solid",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    borderColor: "border",
    "--focus-color": "var(--chakra-colors-border-accent-light)",
    "--focus-ring-style": "none",
    _hover: {
      borderColor: interactiveBorderColor,
    },
    _active: {
      borderColor: interactiveBorderColor,
    },
    _focus: {
      borderColor: interactiveBorderColor,
      outline: "none",
      boxShadow: "none",
    },
    _focusVisible: {
      borderColor: interactiveBorderColor,
      outline: "none",
      boxShadow: "none",
    },
    _placeholder: {
      color: "fg.subtle",
    },
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
        _hover: {
          borderColor: interactiveBorderColor,
        },
        _active: {
          borderColor: interactiveBorderColor,
        },
        _focus: {
          borderColor: interactiveBorderColor,
          outline: "none",
          boxShadow: "none",
        },
        _focusVisible: {
          borderColor: interactiveBorderColor,
          outline: "none",
          boxShadow: "none",
        },
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
        paddingX: "2xs",
        paddingY: "2xs",
        textStyle: "label/XS",
      },
      xs: {
        paddingX: "xs",
        paddingY: "2xs",
        textStyle: "label/XS",
      },
      sm: {
        paddingX: "sm",
        paddingY: "xs",
        textStyle: "label/S/regular",
      },
      md: {
        paddingX: "sm",
        paddingY: "xs",
        textStyle: "label/M/regular",
      },
      lg: {
        paddingX: "md",
        paddingY: "sm",
        textStyle: "label/M/regular",
      },
    },
  },
  defaultVariants: {
    size: "sm",
    variant: "outline",
  },
});
