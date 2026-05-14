import { defineSlotRecipe } from "@chakra-ui/react";
import { tabsAnatomy } from "@chakra-ui/react/anatomy";

export const tabsSlotRecipe = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  base: {
    trigger: {
      borderRadius: "0",
    },
  },
});
