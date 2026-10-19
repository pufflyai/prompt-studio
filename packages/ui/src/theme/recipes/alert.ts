import { defineSlotRecipe } from "@chakra-ui/react";
import { alertAnatomy } from "@chakra-ui/react/anatomy";

const rootDensity = { px: "xs", py: "2xs", gap: "2xs" };

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
        maxWidth: "full",
        height: "auto",
        minHeight: "7",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      },
    },
    indicator: {
      mt: "0.0625rem",
    },
    content: {
      gap: "0",
      minWidth: "0",
    },
    title: {
      textStyle: "label/S/medium",
      overflowWrap: "anywhere",
    },
    description: {
      textStyle: "paragraph/S/regular",
      overflowWrap: "anywhere",
    },
  },
  variants: {
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
