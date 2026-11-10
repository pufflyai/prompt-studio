import { defineSlotRecipe } from "@chakra-ui/react";

export const dataTableRecipe = defineSlotRecipe({
  slots: ["root", "chart", "sparkline", "bar", "barPlot", "label", "value"],
  base: {
    root: { "--table-row-height": "{sizes.10}", "--table-chart-height": "{sizes.6}", "--table-chart-labels": "none" },
    chart: {
      display: "flex",
      flexDirection: "column",
      w: "full",
      minW: "0",
      h: "var(--table-chart-height, {sizes.6})",
      gap: "2xs",
      color: "fg.muted",
      "&[data-table-chart=bar-chart]": { h: "auto", minH: "var(--table-chart-height, {sizes.6})" },
    },
    sparkline: { display: "block", w: "full", h: "full", overflow: "visible" },
    bar: { display: "flex", alignItems: "center", gap: "xs", minH: "0", flex: "1" },
    barPlot: { display: "block", flex: "1", minW: "0", w: "full", h: "2.5" },
    label: {
      display: "var(--table-chart-labels, none)",
      textStyle: "label/XS",
      w: "12",
      flexShrink: "0",
      truncate: true,
    },
    value: { display: "var(--table-chart-labels, none)", textStyle: "mono/XS", flexShrink: "0" },
  },
  variants: {
    rowHeight: {
      compact: {},
      comfortable: {
        root: {
          "--table-row-height": "{sizes.16}",
          "--table-chart-height": "{sizes.10}",
          "--table-chart-labels": "block",
        },
      },
      tall: {
        root: {
          "--table-row-height": "{sizes.24}",
          "--table-chart-height": "{sizes.16}",
          "--table-chart-labels": "block",
        },
      },
    },
  },
  defaultVariants: { rowHeight: "compact" },
});
