import { defineRecipe } from "@chakra-ui/react";

export const treeRevealRecipe = defineRecipe({
  base: {
    display: "grid",
    gridTemplateRows: "0fr",
    visibility: "hidden",
    transition: "grid-template-rows {durations.tree-collapse} {easings.exit}, visibility 0s {durations.tree-collapse}",
    "&[data-open=true]": {
      gridTemplateRows: "1fr",
      visibility: "visible",
      transition: "grid-template-rows {durations.tree-expand} {easings.enter}, visibility 0s",
      _motionReduce: { transition: "none" },
    },
    "& > *": { minHeight: "0", overflow: "hidden" },
    _motionReduce: { transition: "none" },
  },
});

export const treeChevronRecipe = defineRecipe({
  base: {
    transform: "rotate(0deg)",
    transition: "transform {durations.tree-collapse} {easings.exit}",
    "&[data-open=true]": {
      transform: "rotate(90deg)",
      transition: "transform {durations.tree-expand} {easings.enter}",
      _motionReduce: { transition: "none" },
    },
    "&:is([data-tree-list-virtual] *)": { transition: "none" },
    _motionReduce: { transition: "none" },
  },
});

export const bubblePanelRecipe = defineRecipe({
  base: {
    visibility: "hidden",
    opacity: "0",
    transform: "translateY({spacing.2}) scale(0.96)",
    transformOrigin: "bottom right",
    transition:
      "opacity {durations.panel-close} {easings.exit}, transform {durations.panel-close} {easings.exit}, visibility 0s {durations.panel-close}",
    "&[data-open=true]": {
      visibility: "visible",
      opacity: "1",
      transform: "none",
      transition:
        "opacity {durations.panel-open} {easings.enter}, transform {durations.panel-open} {easings.enter}, visibility 0s",
      _startingStyle: { opacity: "0", transform: "translateY({spacing.2}) scale(0.96)" },
    },
    _motionReduce: {
      transform: "none",
      "&[data-open=true]": { _startingStyle: { transform: "none" } },
    },
  },
});

export const bubbleLauncherRecipe = defineRecipe({
  base: {
    // The launcher owns reveal motion; inherited visibility must not animate again on its button.
    "& > button": { transitionProperty: "background-color, border-color, box-shadow, color" },
    visibility: "visible",
    opacity: "1",
    transform: "none",
    transition:
      "opacity {durations.surface-enter} {easings.enter}, transform {durations.surface-enter} {easings.enter}, visibility 0s",
    "&[data-open=true]": {
      visibility: "hidden",
      opacity: "0",
      transform: "scale(0.9)",
      transition:
        "opacity {durations.surface-exit} {easings.exit}, transform {durations.surface-exit} {easings.exit}, visibility 0s {durations.surface-exit}",
    },
    _motionReduce: { transform: "none", "&[data-open=true]": { transform: "none" } },
  },
});

export const streamingTextRecipe = defineRecipe({
  base: {
    "& .streaming-text-chunk": {
      animation: "text-chunk {durations.text-chunk} {easings.enter}",
      _motionReduce: { animation: "none" },
    },
  },
});
