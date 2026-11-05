import { defineRecipe } from "@chakra-ui/react";

export const skeletonRecipe = defineRecipe({
  base: {
    "--start-color": "fg",
    "--end-color": "fg.muted",
  },
  variants: {
    variant: {
      none: { bg: "bg.emphasized" },
    },
  },
});
