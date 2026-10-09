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
        opacity: 0,
        _groupHover: { opacity: 1 },
        _groupFocusWithin: { opacity: 1 },
      },
    },
  },
  defaultVariants: { variant: "inline" },
});
