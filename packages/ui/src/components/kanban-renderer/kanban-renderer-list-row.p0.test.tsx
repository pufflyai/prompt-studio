import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { createResourceContextActions } from "../list-row/list-row-chrome";
import { KanbanRendererListRow } from "./kanban-renderer-list-row";

test("group creation is an independent button rather than a button nested in the group trigger", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <KanbanRendererListRow
        row={{
          id: "group",
          item: {
            id: "group",
            title: "This device",
            isGroup: true,
            onCreate: () => {},
            note: "2 / 6",
            onNoteClick: () => {},
          },
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
  expect(html).toContain('aria-label="This device: 2 / 6"');
  let buttonDepth = 0;
  for (const [tag] of html.matchAll(/<\/?button\b[^>]*>/g)) {
    buttonDepth += tag.startsWith("</") ? -1 : 1;
    expect(buttonDepth).toBeLessThanOrEqual(1);
  }
});

test("Kanban list Copy actions keep selection-time execution through the row menu", () => {
  const calls: string[] = [];
  const row = KanbanRendererListRow({
    row: {
      id: "note",
      item: {
        id: "note",
        title: "Note",
        contextMenuActions: [
          {
            key: "copy",
            label: "Copy",
            onSelect: () => {
              calls.push("copy");
            },
          },
          {
            key: "open",
            label: "Open",
            onClick: () => {
              calls.push("open");
            },
          },
        ],
      },
      depth: 0,
      isGroup: false,
      canExpand: false,
    },
    isExpanded: false,
    selectedItemId: null,
    activeDropTargetId: null,
    draggedItemId: null,
    onDraggedItemChange() {},
    onDropTargetChange() {},
    onExpandedChange() {},
  });
  const items = row.props.children.props.contextMenuItems;
  const [copy, open] = createResourceContextActions(items);
  expect(items[0].runOnSelect).toBe(true);
  copy?.onSelect?.();
  expect(calls).toEqual(["copy"]);
  expect(copy?.onClick).toBeUndefined();
  expect(open?.onSelect).toBeUndefined();
  open?.onClick?.();
  expect(calls).toEqual(["copy", "open"]);
});
