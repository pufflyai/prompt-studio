import { defineSlotRecipe } from "@chakra-ui/react";

export const keyboardBubbleSlotRecipe = defineSlotRecipe({
  slots: ["root", "sequence", "choices", "title", "status"],
  base: {
    root: {
      position: "fixed",
      left: "50%",
      bottom: "sm",
      transform: "translateX(-50%)",
      zIndex: "popover",
      bg: "bg",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "2xs",
      width: "max-content",
      maxW: "keyboard-bubble-max",
      overflow: "hidden",
      outline: "none",
      "&[data-expanded=true]": { width: "keyboard-bubble" },
    },
    sequence: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: "2xs",
      p: "2xs",
      minH: "8",
      outline: "none",
    },
    choices: { borderBottomWidth: "1px", borderColor: "border.subtle" },
    title: { px: "sm", py: "xs", textStyle: "label/XS/medium", color: "fg.muted" },
    status: { px: "sm", py: "xs", textStyle: "label/XS/regular" },
  },
});
