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
        visibility: "hidden",
        opacity: 0,
        _groupHover: { visibility: "visible", opacity: 1 },
        _groupFocusWithin: { visibility: "visible", opacity: 1 },
        "@media (hover: none)": { visibility: "visible", opacity: 1 },
      },
    },
  },
  defaultVariants: { visibility: "always" },
});
