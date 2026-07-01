import { defineSlotRecipe } from "@chakra-ui/react";
import { numberInputAnatomy } from "@chakra-ui/react/anatomy";

const restingBorderColor = "var(--chakra-colors-border)";
const interactiveBorderColor = "var(--chakra-colors-border-accent-light)";

export const numberInputSlotRecipe = defineSlotRecipe({
  slots: numberInputAnatomy.keys(),
  base: {
    root: {
      position: "relative",
      zIndex: "0",
      isolation: "isolate",
      boxShadow: "none",
      "--number-input-border-color": restingBorderColor,
      "&:is(:hover, [data-hover])": {
        "--number-input-border-color": interactiveBorderColor,
      },
      "&:is(:active, [data-active])": {
        "--number-input-border-color": interactiveBorderColor,
      },
      "&:focus-within": {
        "--number-input-border-color": interactiveBorderColor,
      },
    },
    input: {
      px: "sm",
      pe: "calc(var(--stepper-width) + 0.5rem)",
      borderRadius: "xs",
      transition: "border-color 0.2s ease-in-out",
      bg: "bg",
      color: "fg",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "var(--number-input-border-color)",
      outline: "none",
      boxShadow: "none",
      "--focus-ring-color": "var(--number-input-border-color)",
      "--focus-ring-style": "none",
      _hover: { borderColor: "var(--number-input-border-color)" },
      _active: { borderColor: "var(--number-input-border-color)" },
      _focus: { borderColor: "var(--number-input-border-color)", outline: "none", boxShadow: "none" },
      _focusVisible: { borderColor: "var(--number-input-border-color)", outline: "none", boxShadow: "none" },
      _placeholder: { color: "fg.subtle" },
      "&:is(:hover, [data-hover])": {
        borderColor: "var(--number-input-border-color)",
      },
      "&:is(:active, [data-active])": {
        borderColor: "var(--number-input-border-color)",
      },
      "&:not([data-invalid], [aria-invalid='true'], [data-state='invalid'])": {
        borderColor: "var(--number-input-border-color)",
      },
    },
    control: {
      display: "flex",
      flexDirection: "column",
      position: "absolute",
      top: "0",
      insetEnd: "0",
      margin: "1px",
      width: "var(--stepper-width)",
      height: "calc(100% - 2px)",
      zIndex: "1",
      borderStartWidth: "1px",
      borderStartColor: "var(--number-input-border-color)",
      borderColor: "var(--number-input-border-color)",
      divideY: "1px",
      overflow: "hidden",
      boxShadow: "none",
      "& > :not(style, [hidden]) ~ :not(style, [hidden])": {
        borderColor: "var(--number-input-border-color)",
      },
    },
    incrementTrigger: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "1",
      minH: "0",
      lineHeight: "1",
      borderTopEndRadius: "xs",
      color: "fg.muted",
      _hover: { bg: "bg.hover", color: "fg" },
    },
    decrementTrigger: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "1",
      minH: "0",
      lineHeight: "1",
      borderBottomEndRadius: "xs",
      color: "fg.muted",
      _hover: { bg: "bg.hover", color: "fg" },
    },
  },
  variants: {
    variant: {
      outline: {
        input: {
          bg: "bg",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--number-input-border-color)",
          outline: "none",
          boxShadow: "none",
          "--focus-ring-color": "var(--number-input-border-color)",
          "--focus-ring-style": "none",
          _hover: { borderColor: "var(--number-input-border-color)" },
          _active: { borderColor: "var(--number-input-border-color)" },
          _focus: { borderColor: "var(--number-input-border-color)", outline: "none", boxShadow: "none" },
          _focusVisible: { borderColor: "var(--number-input-border-color)", outline: "none", boxShadow: "none" },
          "&:is(:hover, [data-hover])": {
            borderColor: "var(--number-input-border-color)",
          },
          "&:is(:active, [data-active])": {
            borderColor: "var(--number-input-border-color)",
          },
          "&:not([data-invalid], [aria-invalid='true'], [data-state='invalid'])": {
            borderColor: "var(--number-input-border-color)",
          },
        },
      },
    },
    size: {
      "2xs": {
        input: {
          h: "1.5rem",
          px: "2xs",
          textStyle: "label/XS",
        },
        control: {
          "--stepper-width": "1.25rem",
          fontSize: "0.625rem",
        },
      },
      xs: {
        input: {
          h: "1.75rem",
          px: "xs",
          textStyle: "label/XS",
        },
        control: {
          "--stepper-width": "1.5rem",
          fontSize: "0.75rem",
        },
      },
      sm: {
        input: {
          h: "2rem",
          px: "sm",
          textStyle: "label/S/regular",
        },
        control: {
          "--stepper-width": "1.75rem",
          fontSize: "0.75rem",
        },
      },
      md: {
        input: {
          h: "2.5rem",
          px: "sm",
          textStyle: "label/M/regular",
        },
        control: {
          "--stepper-width": "2rem",
          fontSize: "0.875rem",
        },
      },
      lg: {
        input: {
          h: "3rem",
          px: "md",
          textStyle: "label/M/regular",
        },
        control: {
          "--stepper-width": "2.25rem",
          fontSize: "0.875rem",
        },
      },
    },
  },
  defaultVariants: {
    size: "sm",
    variant: "outline",
  },
});
