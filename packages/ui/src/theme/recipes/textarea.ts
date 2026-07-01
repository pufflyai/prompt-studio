import { defineRecipe } from "@chakra-ui/react";

export const textareaRecipe = defineRecipe({
  base: {
    paddingX: "sm",
    paddingY: "xs",
    opacity: "1",
    outline: "none",
    color: "fg",
    border: "1px solid",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    borderColor: "border",
    _hover: {
      borderColor: "border",
    },
    _active: {
      borderColor: "border",
    },
    _focus: {
      borderColor: "border.accent",
    },
    _focusVisible: {
      borderColor: "border.accent",
      outline: "none",
    },
    _placeholder: {
      color: "fg.subtle",
    },
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
        _hover: {
          borderColor: "border",
        },
        _active: {
          borderColor: "border",
        },
        _focus: {
          borderColor: "border.accent",
        },
        _focusVisible: {
          borderColor: "border.accent",
          outline: "none",
        },
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
