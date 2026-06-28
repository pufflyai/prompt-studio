import { defineSlotRecipe } from "@chakra-ui/react";
import { dialogAnatomy } from "@chakra-ui/react/anatomy";

export const dialogSlotRecipe = defineSlotRecipe({
  slots: dialogAnatomy.keys(),
  base: {
    content: {
      bg: "bg",
      borderRadius: "xs",
      borderWidth: "1px",
      borderColor: "border.muted",
      overflow: "hidden",
    },
  },
});
