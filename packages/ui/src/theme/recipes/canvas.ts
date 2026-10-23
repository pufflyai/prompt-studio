import { defineRecipe } from "@chakra-ui/react";

export const canvasFrameRecipe = defineRecipe({
  base: {
    position: "relative",
    height: "full",
    minHeight: "0",
    minWidth: "0",
    overflow: "hidden",
    bg: "bg",
    color: "fg",
    backgroundImage:
      "radial-gradient(circle, {colors.canvas.dot} {sizes.canvas-dot-radius}, transparent {sizes.canvas-dot-radius})",
    backgroundSize: "{spacing.lg} {spacing.lg}",
  },
});

export const canvasZoomControlsRecipe = defineRecipe({
  base: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "sm",
    zIndex: "10",
    display: "flex",
    alignItems: "center",
    gap: "2xs",
    p: "2xs",
    bg: "bg",
    color: "fg",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "md",
  },
});

export const canvasRecipe = defineRecipe({
  className: "pstdio-canvas",
  base: {
    position: "absolute",
    inset: "0",
    isolation: "isolate",
    height: "full",
    minHeight: "0",
    minWidth: "0",
    overflow: "hidden",
    overscrollBehavior: "none",
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
