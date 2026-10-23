import { defineRecipe } from "@chakra-ui/react";

export const canvasRecipe = defineRecipe({
  className: "pstdio-canvas",
  base: {
    position: "relative",
    isolation: "isolate",
    height: "full",
    minHeight: "0",
    minWidth: "0",
    overflow: "hidden",
    overscrollBehavior: "none",
    bg: "bg",
    color: "fg",
    _focusVisible: { outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-2px" },
    "&[data-panning]": { userSelect: "none" },
    "& [data-canvas-control]": { cursor: "auto" },
  },
  variants: {
    variant: {
      plain: { cursor: "default" },
      pan: { cursor: "grab", "&[data-panning]": { cursor: "grabbing" } },
    },
  },
  defaultVariants: { variant: "plain" },
});
