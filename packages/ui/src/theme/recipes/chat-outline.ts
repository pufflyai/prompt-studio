import { defineRecipe } from "@chakra-ui/react";

export const chatOutlineRecipe = defineRecipe({
  base: {
    display: "none",
    // The reading column is 46rem wide. Reserve a 3rem gutter on each side.
    "@container (min-width: 52rem)": { display: "flex" },
    position: "absolute",
    insetInlineStart: "xs",
    top: "50%",
    transform: "translateY(-50%)",
    height: "80%",
    alignItems: "center",
    pointerEvents: "none",
    width: "9",
    zIndex: 2,
    "& button": { display: "flex", alignItems: "center", width: "full", h: "4", px: "xs" },
    "& button > span": {
      width: "2",
      h: "0.5",
      bg: "fg.muted",
      transition:
        "width {durations.panel-close} {easings.enter}, background-color {durations.panel-close} {easings.enter}",
      _motionReduce: { transition: "none" },
    },
    "& button[aria-current] > span": { bg: "fg" },
    "& button:is(:hover, :focus-visible) > span": { width: "5", bg: "fg" },
  },
});
