import { defineSlotRecipe } from "@chakra-ui/react";

export const landingCarouselSlotRecipe = defineSlotRecipe({
  slots: ["root", "tabs", "header", "list", "trigger", "slide"],
  base: {
    root: { height: "full", minHeight: 0, minWidth: 0, overflow: "hidden" },
    tabs: {
      display: "grid",
      // Override the shared horizontal tabs layout so the slide receives a bounded scroll viewport.
      _horizontal: { display: "grid" },
      gridTemplateRows: "auto minmax(0, 1fr)",
      height: "full",
      minHeight: 0,
      gap: 0,
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "md",
      px: { base: "sm", md: "xl" },
      py: "xs",
      borderBottomWidth: "1px",
      borderColor: "border.subtle",
      flexShrink: 0,
      minWidth: 0,
    },
    list: { flex: 1, minWidth: 0, minHeight: 0, overflowX: "auto", flexWrap: "nowrap", border: "none" },
    trigger: { flexShrink: 0, whiteSpace: "nowrap", gap: "sm" },
    slide: {
      minHeight: 0,
      minWidth: 0,
      p: 0,
      overflow: "hidden",
      touchAction: "pan-y",
      focusVisibleRing: "inside",
    },
  },
});
