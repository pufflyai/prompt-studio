import { expect, test } from "bun:test";
import { loadSelectedAncestors, selectionAfterDelete } from "./file-selection";

test("deep links preload only selected ancestors so native tree selection can reveal the document", async () => {
  const reads: string[] = [];
  const nodes = [
    { id: "src", label: "src", collapsible: true },
    { id: "other", label: "other", collapsible: true },
  ];
  const result = await loadSelectedAncestors(nodes, "src/lib/a.ts", async (path) => {
    reads.push(path);
    return path === "src"
      ? [{ id: "src/lib", label: "lib", collapsible: true }]
      : [{ id: "src/lib/a.ts", label: "a.ts", selected: true }];
  });
  expect(reads).toEqual(["src", "src/lib"]);
  expect(result[0].children?.[0].children?.[0].selected).toBe(true);
  expect(result[1].children).toBeUndefined();
});
test("deleting an unrelated entry preserves the selected document and deleting its ancestor clears it", () => {
  expect(selectionAfterDelete("src/a.ts", "b.txt")).toBe("src/a.ts");
  expect(selectionAfterDelete("src/a.ts", "src")).toBeUndefined();
  expect(selectionAfterDelete("src/a.ts", "src/a.ts")).toBeUndefined();
  expect(selectionAfterDelete("src-old/a.ts", "src")).toBe("src-old/a.ts");
});
