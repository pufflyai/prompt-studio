import { defineRecipe } from "@chakra-ui/react";

export const linkRecipe = defineRecipe({
  variants: {
    variant: {
      resource: {
        textDecoration: "none",
        _hover: { textDecoration: "none" },
      },
    },
  },
});
