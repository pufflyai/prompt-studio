import { defineSlotRecipe } from "@chakra-ui/react";

const stackedPanels = {
  root: { flexDirection: "column", height: "auto", overflow: "visible", gap: "panel-gap" },
  resizablePanel: { display: "flex", width: "full", height: "auto", flex: "initial", overflow: "visible" },
  contentPanel: { height: "auto", flex: "initial", overflow: "visible" },
  separator: { display: "none" },
} as const;

export const resizableSplitLayoutSlotRecipe = defineSlotRecipe({
  slots: ["root", "resizablePanel", "contentPanel", "separator"],
  base: {
    root: { display: "flex", width: "full", minWidth: 0, minHeight: 0 },
    resizablePanel: { minWidth: 0, minHeight: 0, "&[data-collapsed=true]": { display: "none" } },
    contentPanel: { display: "flex", minWidth: 0, minHeight: 0 },
    separator: { "&[data-collapsed=true]": { display: "none" } },
  },
  variants: {
    orientation: {
      horizontal: {
        root: { "--split-direction": "row", "--split-width": "var(--split-size)", "--split-height": "100%" },
      },
      vertical: {
        root: { "--split-direction": "column", "--split-width": "100%", "--split-height": "var(--split-size)" },
      },
    },
    layout: {
      split: {
        root: { flexDirection: "var(--split-direction)", height: "full", overflow: "hidden", gap: "0" },
        resizablePanel: {
          display: "flex",
          width: "var(--split-width)",
          height: "var(--split-height)",
          flex: "0 0 var(--split-size)",
          overflow: "hidden",
        },
        contentPanel: { height: "full", flex: "1", overflow: "hidden" },
        separator: { display: "flex" },
      },
      stacked: stackedPanels,
      "stacked-reverse": {
        ...stackedPanels,
        root: { ...stackedPanels.root, flexDirection: "column-reverse" },
      },
      content: {
        root: { height: "full", overflow: "hidden" },
        resizablePanel: { display: "none" },
        contentPanel: { height: "full", flex: "1", overflow: "hidden" },
        separator: { display: "none" },
      },
    },
  },
  defaultVariants: { orientation: "horizontal", layout: "split" },
});
