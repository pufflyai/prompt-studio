import { defineSlotRecipe } from "@chakra-ui/react";

export const kanbanBoardColumnSlotRecipe = defineSlotRecipe({
  slots: ["root", "header", "entry", "empty", "scrollbar"],
  base: {
    root: { paddingY: "compact" },
    header: { paddingX: "compact" },
    entry: { paddingX: "compact", paddingBottom: "xs" },
    empty: { paddingX: "compact" },
    scrollbar: { margin: "0" },
  },
});
