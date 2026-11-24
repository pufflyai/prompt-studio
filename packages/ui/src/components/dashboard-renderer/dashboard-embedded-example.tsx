import { HStack, Text } from "@chakra-ui/react";
import { defineChart, lineY, ruleX } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { useState } from "react";
import { Chart, chartColor } from "@/components/charts/chart";
import { DashboardRenderer } from "./dashboard-renderer";
import type { DashboardDefinition } from "./dashboard-types";

const initial: DashboardDefinition = {
  mode: "vertical",
  widgets: [{ id: "releases", title: "", kind: "custom", source: "releases", layout: { x: 0, y: 0, w: 12, h: 8 } }],
};

const chart = defineChart({
  scales: { x: { scale: scaleLinear }, y: { scale: scaleLinear } },
  marks: [
    lineY(
      [
        { day: 1, builds: 4 },
        { day: 2, builds: 9 },
        { day: 3, builds: 6 },
      ],
      { x: "day", y: "builds", stroke: chartColor("vis.categorical.4") },
    ),
    decorative(ruleX([2], { stroke: chartColor("vis.categorical.2"), strokeDasharray: "4 4" })),
  ],
});

export function DashboardEmbeddedExample() {
  const [value, setValue] = useState(initial);
  return (
    <DashboardRenderer
      value={value}
      onChange={setValue}
      sources={[
        {
          id: "releases",
          name: "Build history",
          content: <Chart definition={chart} ariaLabel="Build count with a release marker" height={220} />,
        },
      ]}
      renderToolbar={(controls) => (
        <HStack
          role="toolbar"
          aria-label="Build history controls"
          justify="space-between"
          flexWrap="wrap"
          p="md"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <Text as="h1" textStyle="heading/S">
            Build history
          </Text>
          {controls}
        </HStack>
      )}
    />
  );
}
