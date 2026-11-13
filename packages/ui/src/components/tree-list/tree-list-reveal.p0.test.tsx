import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { TreeListReveal, useTreeListRowVisibility } from "./tree-list-reveal";

const RowVisibility = () => {
  return <output>{String(useTreeListRowVisibility())}</output>;
};

test("tree rows outside a collapsed section can observe optional data", () => {
  expect(renderToStaticMarkup(<RowVisibility />)).toBe("<output>true</output>");
});

test("collapsed tree rows stop optional observations while their content stays mounted", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <TreeListReveal open={false}>
        <RowVisibility />
      </TreeListReveal>
    </ChakraProvider>,
  );
  expect(html).toContain("<output>false</output>");
});

test("an expanded nested section remains inactive beneath a collapsed ancestor", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <TreeListReveal open={false}>
        <TreeListReveal open>
          <RowVisibility />
        </TreeListReveal>
      </TreeListReveal>
    </ChakraProvider>,
  );
  expect(html).toContain("<output>false</output>");
});
