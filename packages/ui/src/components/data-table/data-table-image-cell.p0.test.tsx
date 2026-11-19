import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import type { DataTableRendererImageOptions } from "@pstdio/sdk/extensions";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { DataTableImageCell } from "./data-table-image-cell";

const markup = (value: unknown, renderer: DataTableRendererImageOptions = { type: "image" }) =>
  renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <DataTableImageCell columnLabel="Photo" renderer={renderer} value={value} />
    </ChakraProvider>,
  );

test("an image cell names its images for screen readers and opens a preview from a button", () => {
  const html = markup({ src: "https://cdn.example.com/shoe.png", alt: "Trail shoe" });
  expect(html).toContain('aria-label="View Photo: Trail shoe"');
  expect(html).toContain('src="https://cdn.example.com/shoe.png"');
  expect(html).toContain("<button");
});

test("galleries show three thumbnails and count the rest", () => {
  const html = markup(["a.png", "b.png", "c.png", "d.png", "e.png"]);
  expect(html.match(/<img/g)).toHaveLength(3);
  expect(html).toContain("+2");
});

test("an empty image cell shows a dash instead of a broken image", () => {
  const html = markup(null);
  expect(html).not.toContain("<img");
  expect(html).toContain("—");
});
