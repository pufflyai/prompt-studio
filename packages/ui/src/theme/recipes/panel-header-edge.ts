import { defineRecipe } from "@chakra-ui/react";

export const panelHeaderEdgeRecipe = defineRecipe({
  base: {
    position: "absolute",
    insetInline: "0",
    top: "0",
    h: "2",
    zIndex: "2",
    outline: "none",
    _focusVisible: { outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-2px" },
  },
});
