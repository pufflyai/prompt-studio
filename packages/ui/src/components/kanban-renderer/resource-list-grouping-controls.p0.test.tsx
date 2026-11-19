import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { ResourceListGroupingControls } from "./resource-list-grouping-controls";

const groupingOptions = [
  { value: "none", label: "None" },
  { value: "region", label: "Region" },
  { value: "channel", label: "Channel" },
  { value: "severity", label: "Severity" },
];

const markup = (settings: { columnGrouping: string; subGroupings?: string[] }) =>
  renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ResourceListGroupingControls
        settings={settings}
        groupingOptions={groupingOptions}
        onSubGroupingsChange={() => {}}
      />
    </ChakraProvider>,
  );

test("each sub-grouping level has its own numbered control and more can be added", () => {
  const html = markup({ columnGrouping: "region", subGroupings: ["channel"] });
  expect(html).toContain("Sub-grouping");
  expect(html).toContain("Channel");
  expect(html).toContain("Add sub-grouping 2");
});

test("no more levels are offered once every groupable field is used", () => {
  const html = markup({ columnGrouping: "region", subGroupings: ["channel", "severity"] });
  expect(html).toContain("Sub-grouping 2");
  expect(html).not.toContain("Add sub-grouping");
});

test("sub-groupings are hidden until there is a grouping", () => {
  expect(markup({ columnGrouping: "none" })).not.toContain("Sub-grouping");
});
