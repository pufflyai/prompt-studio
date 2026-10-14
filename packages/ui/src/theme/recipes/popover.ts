import { defineSlotRecipe } from "@chakra-ui/react";
import { popoverAnatomy } from "@chakra-ui/react/anatomy";

export const popoverRecipe = defineSlotRecipe({
  slots: popoverAnatomy.keys(),
  base: {
    positioner: {
      _focus: { outline: "none" },
    },
    closeTrigger: {
      textStyle: "label/M/medium",
      color: "fg",
    },
    arrow: {
      bg: "background-primary !important",
      borderColor: "button-secondary-stroke",
    },
    content: {
      gap: "8px",
      py: "xs",
      borderRadius: "xs",
      bg: "bg",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "border.subtle",
      overflow: "visible",
      _focus: { outline: "none" },
    },
    title: {
      borderBottom: "none",
      textStyle: "label/M/medium",
      bg: "bg",
    },
    body: { textStyle: "primary" },
    footer: {},
  },
  variants: {
    variant: {
      panel: {
        content: { "--popover-size": "sizes.popover-panel", padding: "md", gap: "md", borderColor: "border" },
        header: { padding: "0" },
        title: { textStyle: "label/M/medium" },
        body: { padding: "0" },
        footer: { padding: "0" },
      },
      responsive: {
        content: { width: "unset" },
      },
    },
    size: {
      "2xl": {
        content: { width: "2xl" },
      },
    },
  },
});
