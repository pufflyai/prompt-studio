import { defineSlotRecipe } from "@chakra-ui/react";
import { alertAnatomy } from "@chakra-ui/react/anatomy";

const rootDensity = { px: "xs", py: "2xs", gap: "xs" };

export const alertSlotRecipe = defineSlotRecipe({
  slots: alertAnatomy.keys(),
  base: {
    root: {
      ...rootDensity,
      borderRadius: "xs",
      alignItems: "flex-start",
      minH: "auto",
      "& .chakra-button": {
        color: "inherit",
        bg: "transparent",
        maxWidth: "full",
        height: "auto",
        minHeight: "6",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        "&:not(:disabled, [data-disabled])": {
          _hover: { "&:not(:active, [data-active])": { bg: "currentColor/10" } },
          _focusVisible: { bg: "currentColor/10", outlineColor: "currentColor" },
          _active: { bg: "currentColor/20" },
        },
      },
    },
    indicator: {
      mt: "2xs",
    },
    content: {
      gap: "0",
      minWidth: "0",
    },
    title: {
      textStyle: "label/M/medium",
      py: "0.5",
      overflowWrap: "anywhere",
    },
    description: {
      textStyle: "paragraph/S/regular",
      overflowWrap: "anywhere",
    },
  },
  variants: {
    status: { info: {}, success: {}, warning: {}, error: {}, neutral: {} },
    variant: { subtle: {}, surface: {}, outline: {}, solid: {} },
    size: {
      sm: { root: rootDensity },
      md: { root: rootDensity },
      lg: { root: rootDensity },
    },
  },
  compoundVariants: [
    {
      status: "info",
      variant: "subtle",
      css: {
        root: {
          bg: "bg.info",
          color: "fg.info",
        },
        indicator: {
          color: "fg.info",
        },
      },
    },
    {
      status: "success",
      variant: "subtle",
      css: {
        root: {
          bg: "bg.success",
          color: "fg.success",
        },
        indicator: {
          color: "fg.success",
        },
      },
    },
    {
      status: "warning",
      variant: "subtle",
      css: {
        root: {
          bg: "bg.warning",
          color: "fg.warning",
        },
        indicator: {
          color: "fg.warning",
        },
      },
    },
    {
      status: "error",
      variant: "subtle",
      css: {
        root: {
          bg: "bg.error",
          color: "fg.error",
        },
        indicator: {
          color: "fg.error",
        },
      },
    },
  ],
});
