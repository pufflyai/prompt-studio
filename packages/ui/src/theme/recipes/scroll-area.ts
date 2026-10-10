import { defineSlotRecipe } from "@chakra-ui/react";

export const scrollAreaSlotRecipe = defineSlotRecipe({
  slots: ["root", "viewport", "content", "scrollbar", "thumb", "corner"],
  base: {
    content: {
      // Keep changing scrollbar geometry out of transcript styles. See ADR 0066.
      "--thumb-width": "initial",
      "--thumb-height": "initial",
      "--corner-width": "initial",
      "--corner-height": "initial",
      "--scroll-area-overflow-x-start": "initial",
      "--scroll-area-overflow-x-end": "initial",
      "--scroll-area-overflow-y-start": "initial",
      "--scroll-area-overflow-y-end": "initial",
    },
  },
});
