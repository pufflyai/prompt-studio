import { defineRecipe } from "@chakra-ui/react";

export const paletteShortcutRecipe = defineRecipe({
  className: "ps-palette-shortcut",
  variants: {
    variant: {
      inline: { display: "contents" },
      sidenav: {
        display: "inline-flex",
        alignItems: "center",
        pointerEvents: "none",
      },
    },
  },
  defaultVariants: { variant: "inline" },
});
