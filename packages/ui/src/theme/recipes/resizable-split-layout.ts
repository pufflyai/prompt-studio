import { defineSlotRecipe } from "@chakra-ui/react";

const stackedPanels = {
  root: { flexDirection: "column", height: "auto", overflow: "visible", gap: "panel-gap" },
  resizablePanel: { display: "flex", width: "full", height: "auto", flex: "initial", overflow: "visible" },
  panelContent: { width: "full", height: "auto", flex: "1" },
  contentPanel: { height: "auto", flex: "initial", overflow: "visible" },
  separator: { display: "none" },
} as const;

export const resizableSplitLayoutSlotRecipe = defineSlotRecipe({
  slots: ["root", "resizablePanel", "panelContent", "contentPanel", "separator"],
  base: {
    root: { display: "flex", width: "full", minWidth: 0, minHeight: 0 },
    resizablePanel: { minWidth: 0, minHeight: 0, "&[data-collapsed=true]": { display: "none" } },
    panelContent: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, flexShrink: 0 },
    contentPanel: { display: "flex", minWidth: 0, minHeight: 0 },
    separator: { "&[data-collapsed=true]": { display: "none" } },
  },
  variants: {
    orientation: {
      horizontal: {
        root: {
          "--split-direction": "row",
          "--split-width": "var(--split-size)",
          "--split-height": "100%",
          "--split-content-width": "var(--split-stored-size)",
          "--split-content-height": "100%",
          "&[data-dragging=true]": { "--split-content-width": "var(--split-size)" },
        },
        separator: {
          width: "var(--split-separator-thickness)",
          height: "full",
          "&[data-collapsed=true]": { width: "0" },
        },
      },
      vertical: {
        root: {
          "--split-direction": "column",
          "--split-width": "100%",
          "--split-height": "var(--split-size)",
          "--split-content-width": "100%",
          "--split-content-height": "var(--split-stored-size)",
          "&[data-dragging=true]": { "--split-content-height": "var(--split-size)" },
        },
        separator: {
          width: "full",
          height: "var(--split-separator-thickness)",
          "&[data-collapsed=true]": { height: "0" },
        },
      },
    },
    separator: {
      gap: { separator: { "--split-separator-thickness": "{spacing.panel-gap}" } },
      line: { separator: { "--split-separator-thickness": "1px" } },
    },
    layout: {
      split: {
        root: {
          flexDirection: "var(--split-direction)",
          height: "full",
          overflow: "clip",
          gap: "0",
          transition: "--split-size {durations.panel-open} {easings.enter}",
          "&[data-collapsed=true]": {
            transition: "--split-size {durations.panel-close} {easings.exit}",
            _motionReduce: { transition: "none" },
          },
          "&[data-dragging=true]": { transition: "none" },
          _motionReduce: { transition: "none" },
        },
        resizablePanel: {
          display: "flex",
          width: "var(--split-width)",
          height: "var(--split-height)",
          flex: "0 0 var(--split-size)",
          overflow: "hidden",
          visibility: "visible",
          transition: "visibility 0s",
          "&[data-collapsed=true]": {
            display: "flex",
            visibility: "hidden",
            transition: "visibility 0s {durations.panel-close}",
            _motionReduce: { transition: "none" },
          },
          "[data-dragging=true] &": { transition: "none" },
          _motionReduce: { transition: "none" },
        },
        panelContent: { width: "var(--split-content-width)", height: "var(--split-content-height)" },
        contentPanel: { height: "full", flex: "1", overflow: "hidden" },
        separator: {
          display: "flex",
          visibility: "visible",
          transition: "visibility 0s, width 0s, height 0s",
          "&[data-collapsed=true]": {
            display: "flex",
            visibility: "hidden",
            transition:
              "visibility 0s {durations.panel-close}, width 0s {durations.panel-close}, height 0s {durations.panel-close}",
            _motionReduce: { transition: "none" },
          },
          "[data-dragging=true] &": { transition: "none" },
          _motionReduce: { transition: "none" },
        },
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
  defaultVariants: { orientation: "horizontal", layout: "split", separator: "gap" },
});
