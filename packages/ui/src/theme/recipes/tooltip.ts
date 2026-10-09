import { defineSlotRecipe } from "@chakra-ui/react";
import { tooltipAnatomy } from "@chakra-ui/react/anatomy";

export const tooltipRecipe = defineSlotRecipe({
  slots: tooltipAnatomy.keys(),
  base: {
    content: {
      bg: "bg.inverted",
      borderRadius: "xs",
      color: "fg.inverted",
      "& .chakra-kbd": {
        color: "fg.inverted",
        bg: "transparent",
        borderColor: "border.inverted",
      },
    },
  },
});
