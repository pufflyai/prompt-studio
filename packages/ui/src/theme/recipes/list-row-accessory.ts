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
        transition: "opacity 0s {durations.hover-exit-delay}, visibility 0s {durations.hover-exit-delay}",
        _groupHover: { visibility: "visible", opacity: 1, transitionDelay: "0s" },
        _groupFocusWithin: { visibility: "visible", opacity: 1, transitionDelay: "0s" },
        "@media (hover: none)": { visibility: "visible", opacity: 1 },
      },
    },
  },
  defaultVariants: { visibility: "always" },
});
