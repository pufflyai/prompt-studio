import { defineSlotRecipe } from "@chakra-ui/react";

export const editableSlotRecipe = defineSlotRecipe({
  slots: ["preview", "input", "textarea"] as const,
  base: {
    preview: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border",
      py: "0",
      lineHeight: "1.5rem",
      transitionProperty: "common",
      transitionDuration: "normal",
      _hover: { bg: "bg.hover" },
    },
    input: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border",
      py: "0",
      lineHeight: "1.5rem",
      transitionProperty: "common",
      transitionDuration: "normal",
      bg: "bg",
      width: "auto",
      _focusVisible: { boxShadow: "none" },
      _placeholder: { color: "fg.muted" },
    },
    textarea: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border",
      py: "0",
      transitionProperty: "common",
      transitionDuration: "normal",
      bg: "bg.muted",
      width: "auto",
      _focusVisible: { boxShadow: "none" },
      _placeholder: { color: "fg.muted" },
    },
  },
});
