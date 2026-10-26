import { describe, expect, test } from "bun:test";
import { readDraggedTreeNodeId, writeDraggedTreeNodeId } from "./tree-list-drag";

describe("tree list drag data", () => {
  test("keeps the dragged node id in the data transfer", () => {
    const values = new Map<string, string>();
    const dataTransfer = {
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
    };

    writeDraggedTreeNodeId(dataTransfer, "README.md");

    expect(readDraggedTreeNodeId(dataTransfer)).toBe("README.md");
  });
});
