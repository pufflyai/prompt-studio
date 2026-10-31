import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { RowActions } from "./list-row-actions";

test.each([1, 8])("action menus with %i items keep their trigger semantics with a tooltip", (count) => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <RowActions
        context={{}}
        actions={[
          {
            id: "actions",
            label: "Actions",
            menuItems: Array.from({ length: count }, (_, i) => ({ id: String(i), label: `Action ${i}` })),
          },
        ]}
      />
    </ChakraProvider>,
  );
  const button = html.match(/<button\b[^>]*>/)?.[0];
  expect(button).toContain('aria-haspopup="menu"');
});

test("icon actions expose tooltip triggers without separate tooltip text", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <RowActions context={{}} actions={[{ id: "new-workspace", label: "New workspace" }]} />
    </ChakraProvider>,
  );
  const button = html.match(/<button\b[^>]*>/)?.[0];
  expect(button).toContain('data-scope="tooltip"');
});
