import { defineSlotRecipe } from "@chakra-ui/react";
import { alertAnatomy } from "@chakra-ui/react/anatomy";

export const alertSlotRecipe = defineSlotRecipe({
  slots: alertAnatomy.keys(),
  base: {
    root: {
      px: "xs",
      py: "2xs",
      gap: "2xs",
      borderRadius: "xs",
      alignItems: "flex-start",
      minH: "auto",
    },
    indicator: {
      mt: "0.0625rem",
    },
    content: {
      gap: "0",
    },
    title: {
      textStyle: "label/S/medium",
    },
    description: {
      textStyle: "paragraph/S/regular",
    },
  },
  variants: {
    // Chakra's alert recipe styles these; they are listed so the compound variants below can name them.
    status: { info: {}, warning: {}, success: {}, error: {}, neutral: {} },
    variant: { subtle: {}, surface: {}, outline: {}, solid: {} },
    // A banner spans the edge of its panel, so it has square corners.
    layout: {
      inline: {},
      banner: { root: { borderRadius: "0" } },
    },
  },
  defaultVariants: { layout: "inline" },
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
