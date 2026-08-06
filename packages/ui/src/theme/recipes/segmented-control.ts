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
        root: { height: "segmented-control-sm" },
        item: { height: "segmented-control-item-sm", paddingInline: "compact" },
      },
      xs: {
        root: { height: "segmented-control-xs" },
        item: { height: "segmented-control-item-xs", paddingInline: "xs" },
      },
    },
  },
  defaultVariants: {
    size: "sm",
  },
});
