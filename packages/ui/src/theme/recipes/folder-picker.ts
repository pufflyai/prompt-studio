import { defineSlotRecipe } from "@chakra-ui/react";

export const folderPickerSlotRecipe = defineSlotRecipe({
  slots: [
    "content",
    "header",
    "body",
    "navigation",
    "navigationButton",
    "path",
    "filter",
    "creation",
    "list",
    "rows",
    "footer",
  ],
  base: {
    content: {
      width: "folder-picker-width",
      height: "folder-picker-height",
      maxWidth: "calc(100vw - {spacing.xl})",
      maxHeight: "calc(100dvh - {spacing.xl})",
    },
    header: {
      display: "flex",
      height: "folder-picker-header",
      flex: "0 0 auto",
      px: "md",
      py: "none",
      alignItems: "center",
    },
    body: { display: "flex", flexDirection: "column", gap: "sm", p: "md", minHeight: 0 },
    navigation: { display: "flex", gap: "xs", flexShrink: 0, alignItems: "center" },
    navigationButton: { width: "8", minWidth: "8", px: "none" },
    path: { flex: 1, minWidth: 0, px: "2xs", textStyle: "label/S/medium" },
    filter: { width: "full", flexShrink: 0, "& svg": { boxSize: "icon-sm" } },
    creation: { display: "flex", gap: "sm", flexShrink: 0 },
    list: { flex: 1, minHeight: 0 },
    rows: { display: "flex", flexDirection: "column", gap: "2xs" },
    footer: { height: "14", flexShrink: 0, px: "md", py: "none", gap: "xs" },
  },
});
