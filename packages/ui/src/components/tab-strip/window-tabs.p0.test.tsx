import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { WindowTabs } from "./window-tabs";

test("a project that cannot close still has a selectable tab without a close control", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <WindowTabs
        aria-label="Projects"
        tabs={[
          { id: "a", label: "Active" },
          { id: "b", label: "Other", closable: false },
        ]}
        selectedId="a"
        onSelect={() => {}}
        onClose={() => {}}
      />{" "}
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Close Active"');
  expect(html).toContain('aria-label="Other"');
  expect(html).not.toContain('aria-label="Close Other"');
});
