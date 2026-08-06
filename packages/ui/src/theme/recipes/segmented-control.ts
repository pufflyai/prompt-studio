import { defineSlotRecipe } from "@chakra-ui/react";

export const segmentedControlSlotRecipe = defineSlotRecipe({
  className: "ps-segmented-control",
  slots: ["root", "item"],
  base: {
    root: {
      display: "inline-flex",
      alignItems: "center",
      gap: "3xs",
      padding: "3xs",
      bg: "bg.subtle",
      borderRadius: "compact",
      borderWidth: "1px",
      borderColor: "border",
    },
    item: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
      textStyle: "label/S/medium",
      color: "fg.muted",
      bg: "transparent",
      borderRadius: "xs",
      cursor: "pointer",
      transitionProperty: "background-color, color",
      transitionDuration: "fast",
      focusVisibleRing: "outside",
      _hover: { color: "fg" },
      _selected: { bg: "bg.inverted", color: "fg.inverted" },
      _disabled: { cursor: "not-allowed", opacity: 0.5, _hover: { color: "fg.muted" } },
    },
  },
  variants: {
    size: {
      sm: {
        root: { height: "28px" },
        item: { height: "24px", paddingInline: "compact" },
      },
      xs: {
        root: { height: "24px" },
        item: { height: "20px", paddingInline: "xs" },
      },
    },
  },
  defaultVariants: {
    size: "sm",
  },
});
