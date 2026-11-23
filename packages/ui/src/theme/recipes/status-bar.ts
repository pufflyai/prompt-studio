import { defineSlotRecipe } from "@chakra-ui/react";

export const statusBarSlotRecipe = defineSlotRecipe({
  slots: ["root", "item", "placeholder", "dragPreview"],
  base: {
    root: {
      display: "flex",
      alignItems: "stretch",
      marginRight: "panel-gap",
      gap: "2xs",
      height: "full",
      minWidth: "0",
    },
    item: {
      position: "absolute",
      insetBlock: "0",
      width: "max-content",
      minWidth: "0",
      marginBlock: "status-widget-inset",
      paddingBlock: "status-widget-inset",
      paddingInline: "xs",
      borderRadius: "xs",
      display: "flex",
      alignItems: "stretch",
      outline: "none",
      "--status-widget-fill": "{colors.bg}",
      bg: "var(--status-widget-fill)",
      // A frame can paint its own canvas. Give it the same fill as the status surface.
      "& iframe": { bg: "var(--status-widget-fill)" },
      _focusWithin: { "--status-widget-fill": "{colors.bg.muted}" },
      "&[data-state=open]": { "--status-widget-fill": "{colors.bg.muted}" },
      _hover: { "--status-widget-fill": "{colors.bg.hover}", color: "fg" },
      "&[data-sortable]": { cursor: "grab" },
      "&[data-dragging]": { opacity: 0 },
    },
    placeholder: {
      position: "absolute",
      top: "50%",
      h: "1.5",
      transform: "translateY(-50%)",
      borderRadius: "pill",
      bg: "bg.drop",
      pointerEvents: "none",
    },
    dragPreview: {
      transform: "translateY(-100%)",
      width: "max-content",
      maxWidth: "tab-label-max",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});
