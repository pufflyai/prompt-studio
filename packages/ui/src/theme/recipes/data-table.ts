import { defineSlotRecipe } from "@chakra-ui/react";

export const dataTableRecipe = defineSlotRecipe({
  slots: ["root", "chart", "sparkline", "bar", "barPlot"],
  base: {
    root: {
      "--table-row-height": "{sizes.10}",
      "--table-chart-height": "{sizes.6}",
      "--table-bar-height": "{sizes.2.5}",
    },
    chart: {
      display: "flex",
      flexDirection: "column",
      w: "full",
      minW: "0",
      h: "var(--table-chart-height, {sizes.6})",
      gap: "2xs",
      color: "fg.muted",
      focusVisibleRing: "inside",
      "&[data-table-chart=bar-chart]": { h: "auto", minH: "var(--table-chart-height, {sizes.6})" },
    },
    sparkline: { display: "block", w: "full", h: "full", overflow: "visible" },
    bar: { display: "flex", flexDirection: "column", justifyContent: "center", flex: "1 0 auto", minW: "0" },
    barPlot: { display: "block", flexShrink: "0", w: "full", h: "var(--table-bar-height, {sizes.2.5})" },
  },
  variants: {
    rowHeight: {
      compact: {},
      comfortable: {
        root: {
          "--table-row-height": "{sizes.16}",
          "--table-chart-height": "{sizes.10}",
          "--table-bar-height": "{sizes.4}",
        },
      },
      tall: {
        root: {
          "--table-row-height": "{sizes.24}",
          "--table-chart-height": "{sizes.16}",
          "--table-bar-height": "{sizes.5}",
        },
      },
    },
  },
  defaultVariants: { rowHeight: "compact" },
});
