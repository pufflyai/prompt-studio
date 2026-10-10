import { defineRecipe } from "@chakra-ui/react";

export const shortcutKeysRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "shortcut-key-gap",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
});
