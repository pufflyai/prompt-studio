import { defineSlotRecipe } from "@chakra-ui/react";

export const popoverHeaderRecipe = defineSlotRecipe({
  slots: ["root", "icon", "title", "actions"],
  base: {
    root: { display: "flex", alignItems: "center", gap: "xs", px: "md", py: "sm", flexShrink: "0", bg: "bg" },
    icon: { display: "flex", flexShrink: "0", color: "fg.muted", _icon: { boxSize: "4" } },
    title: { textStyle: "label/M/medium", minW: "0" },
    actions: { display: "flex", alignItems: "center", gap: "xs", marginLeft: "auto", flexShrink: "0" },
  },
});
