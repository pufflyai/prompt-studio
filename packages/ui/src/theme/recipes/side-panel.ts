import { defineSlotRecipe } from "@chakra-ui/react";

export const sidePanelSlotRecipe = defineSlotRecipe({
  className: "side-panel",
  slots: ["root", "header", "content"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      minH: "0",
      minW: "0",
      overflow: "hidden",
      bg: "bg",
      color: "fg",
    },
    header: {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
      minW: "0",
    },
    content: {
      display: "flex",
      flex: "1",
      flexDirection: "column",
      minH: "0",
      minW: "0",
      overflow: "hidden",
    },
  },
  variants: {
    presentation: {
      docked: {
        root: {
          position: "relative",
          h: "full",
          w: "full",
          borderInlineStartWidth: "1px",
          borderInlineStartColor: "border.subtle",
        },
      },
      floating: {
        root: {
          position: "fixed",
          insetInlineEnd: "sm",
          bottom: "sm",
          w: "side-panel",
          maxW: "side-panel-max-width",
          h: "side-panel-height",
          maxH: "side-panel-max-height",
          borderWidth: "1px",
          borderColor: "border.subtle",
          borderRadius: "xs",
          zIndex: "dropdown",
        },
      },
    },
  },
  defaultVariants: { presentation: "docked" },
});
