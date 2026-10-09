import { defineRecipe } from "@chakra-ui/react";

export const listRowAccessoryRecipe = defineRecipe({
  base: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  variants: {
    visibility: {
      always: {},
      hover: {
        position: "absolute",
        opacity: 0,
        pointerEvents: "none",
        ".group[data-hover] &": { position: "static", opacity: 1, pointerEvents: "auto" },
        _groupFocusWithin: { position: "static", opacity: 1, pointerEvents: "auto" },
      },
    },
  },
  defaultVariants: { visibility: "always" },
});
