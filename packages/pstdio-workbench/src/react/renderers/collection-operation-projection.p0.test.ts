import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { collectionOperation, projectBoardRows, projectTableRows } from "./collection-operation-projection";

const resource = { id: "one", projectId: "project", type: "ticket", extensionId: "planner" };
const boardRow = { id: "board-one", title: "First ticket", attributes: { status: "todo" }, resource };
const tableRow = { id: "table-one", values: { status: "todo", name: "First ticket" }, resource };
const otherRow = { ...tableRow, id: "table-two", resource: { ...resource, id: "two" } };

test("projects one canonical change into loaded rows with different representations", async () => {
  const operations = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "native", extensionId: "pstdio" }));
  const saved = Promise.withResolvers<void>();
  const attempt = operations.submit({
    ...collectionOperation({
      sourceId: "board",
      projectId: "project",
      row: boardRow,
      move: { rowId: boardRow.id, attributes: { status: "done", unseen: "new" }, order: { beforeRowId: "unloaded" } },
    }),
    write: () => saved.promise,
  });
  const pending = operations.getSnapshot().pending;
  expect(projectBoardRows([boardRow], pending, "board")[0]?.attributes.status).toBe("done");
  expect(projectTableRows([tableRow, otherRow], pending)[0]?.values).toEqual({
    status: "done",
    name: "First ticket",
  });
  expect(projectTableRows([otherRow], pending)[0]).toBe(otherRow);
  saved.resolve();
  await attempt.result;
});
