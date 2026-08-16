import { describe, expect, it } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";
import { psTheme } from "../../theme";
import { ListRow } from "./list-row";

const hasNestedButtons = (html: string) => {
  let depth = 0;

  for (const match of html.matchAll(/<\/?button\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth > 0) return true;
    depth += 1;
  }

  return false;
};

const renderRow = () =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <ListRow
        id="workspaces"
        label="Workspaces"
        actions={[{ id: "new-workspace", label: "New workspace", onAction: () => undefined }]}
      />
    </ChakraProvider>,
  );

const renderNavigableContainerRow = () =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <ListRow
        id="fds-core"
        label="Fashion Description System"
        isContainer
        isNavigable
        showExpandToggle
        onActivate={() => undefined}
        onToggleExpand={() => undefined}
      />
    </ChakraProvider>,
  );

describe("ListRow", () => {
  it("renders inline actions without nesting buttons", () => {
    expect(hasNestedButtons(renderRow())).toBe(false);
  });

  it("gives navigable containers a separate expand control without nesting buttons", () => {
    const html = renderNavigableContainerRow();

    expect(hasNestedButtons(html)).toBe(false);
    expect(html).toContain('aria-label="Expand"');
    expect(html).toContain('role="option"');
  });
});
