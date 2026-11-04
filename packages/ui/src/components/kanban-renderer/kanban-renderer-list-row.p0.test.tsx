import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { KanbanRendererListRow } from "./kanban-renderer-list-row";

test("group creation is an independent button rather than a button nested in the group trigger", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <KanbanRendererListRow
        row={{
          id: "group",
          item: { id: "group", title: "This device", isGroup: true, onCreate: () => {} },
          depth: 0,
          isGroup: true,
          canExpand: true,
        }}
        isExpanded
        selectedItemId={null}
        activeDropTargetId={null}
        draggedItemId={null}
        onDraggedItemChange={() => {}}
        onDropTargetChange={() => {}}
        onExpandedChange={() => {}}
      />
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Add to This device"');
  let buttonDepth = 0;
  for (const [tag] of html.matchAll(/<\/?button\b[^>]*>/g)) {
    buttonDepth += tag.startsWith("</") ? -1 : 1;
    expect(buttonDepth).toBeLessThanOrEqual(1);
  }
});
