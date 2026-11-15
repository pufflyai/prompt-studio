import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { TreeRowTags, type TreeRowTagsProps } from "./tree-row-tags";

const markup = (props: TreeRowTagsProps) =>
  renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <TreeRowTags {...props} />
    </ChakraProvider>,
  );

const tags = ["Web shop", "Marketplace", "US", "Required"].map((label) => ({ id: label, label }));

test("two tags show, the rest collapse into a count, and the badge stays last", () => {
  const html = markup({ tags, badge: { label: "3" } });
  expect(html.indexOf("Web shop")).toBeLessThan(html.indexOf("Marketplace"));
  expect(html.indexOf("+2")).toBeGreaterThan(html.indexOf("Marketplace"));
  expect(html.indexOf("+2")).toBeLessThan(html.lastIndexOf(">3<"));
});

test("collapsed tags stay readable to screen readers without adding a tab stop", () => {
  const html = markup({ tags, badge: { label: "3" } });
  expect(html).toContain("US, Required");
  expect(html).not.toContain("tabindex");
  expect(html).not.toContain("aria-label");
});

test("a row without tags or a badge renders nothing", () => {
  expect(TreeRowTags({ tags: [] })).toBeNull();
});
