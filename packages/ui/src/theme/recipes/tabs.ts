import { defineSlotRecipe } from "@chakra-ui/react";
import { tabsAnatomy } from "@chakra-ui/react/anatomy";

export const tabsSlotRecipe = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  base: {
    trigger: {
      borderRadius: "0",
    },
  },
  variants: {
    variant: {
      subtle: {
        trigger: {
          color: "fg.muted",
          bg: "transparent",
          _hover: {
            bg: "bg.hover",
            color: "fg",
          },
          _selected: {
            bg: "bg.muted",
            color: "fg",
          },
        },
      },
    },
  },
});
