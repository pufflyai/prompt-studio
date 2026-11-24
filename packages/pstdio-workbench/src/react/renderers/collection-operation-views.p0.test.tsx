import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { act, create } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { projectBoardRows, projectTableRows } from "./collection-operation-projection";
import { useCollectionOperations } from "./use-collection-operations";
import { useRendererRead } from "./use-renderer-read";

test("a board edit survives an older table read, and both workbenches reconcile before the next write", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const board = createWorkbench({ queries });
  const table = createWorkbench({ queries });
  const resource = { id: "one", type: "ticket", extensionId: "planner", projectId: "project" };
  const queryScope = { projectId: "project", extensionId: "planner" };
  const boardQuery = { sourceId: "board", queryKey: "board", queryScope };
  const tableQuery = { sourceId: "table", queryKey: "table", queryScope };
  const staleRead = Promise.withResolvers<void>();
  const tableEntered = Promise.withResolvers<void>();
  const firstWrite = Promise.withResolvers<void>();
  const secondWrite = Promise.withResolvers<void>();
  let server = "todo";
  let tableReads = 0;
  const writes: string[] = [];
  let submit: ReturnType<typeof useCollectionOperations>["submit"];
  let refreshTable: () => Promise<void>;
  let boardStatus: unknown;
  let tableStatus: unknown;

  const Board = () => {
    const read = useRendererRead({
      ...boardQuery,
      workbench: board,
      ownerKey: "board",
      load: () => [{ id: "card", title: "Ticket", resource, attributes: { status: server } }],
    });
    const rows = read.acceptedValue ?? [];
    const operations = useCollectionOperations(board, boardQuery, rows);
    submit = operations.submit;
    boardStatus = projectBoardRows(rows, operations.pending, "board", "project")[0]?.attributes.status;
    return null;
  };
  const Table = () => {
    const read = useRendererRead({
      ...tableQuery,
      workbench: table,
      ownerKey: "table",
      async load() {
        const value = server;
        if (++tableReads === 2) {
          tableEntered.resolve();
          await staleRead.promise;
        }
        return [{ id: "row", resource, values: { status: value } }];
      },
    });
    const rows = read.acceptedValue ?? [];
    const operations = useCollectionOperations(table, tableQuery, rows);
    refreshTable = read.retry;
    tableStatus = projectTableRows(rows, operations.pending, "project")[0]?.values.status;
    return null;
  };

  let renderer: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <>
          <Board />
          <Table />
        </>,
      );
    });
    expect([boardStatus, tableStatus]).toEqual(["todo", "todo"]);
    let oldRead: Promise<void>;
    await act(async () => {
      oldRead = refreshTable();
      await tableEntered.promise;
    });
    let first: Promise<void>;
    let second: Promise<void>;
    await act(async () => {
      first = submit({ rowId: "card", attributes: { status: "doing" } }, () => {
        writes.push("doing");
        return firstWrite.promise;
      });
      second = submit({ rowId: "card", attributes: { status: "done" } }, () => {
        writes.push("done");
        return secondWrite.promise;
      });
    });
    expect([boardStatus, tableStatus]).toEqual(["done", "done"]);
    await act(async () => {
      server = "doing";
      firstWrite.resolve();
    });
    expect(writes).toEqual(["doing"]);
    await act(async () => {
      staleRead.resolve();
      await oldRead!;
      await first!;
    });
    expect([boardStatus, tableStatus]).toEqual(["done", "done"]);
    expect(writes).toEqual(["doing", "done"]);
    await act(async () => {
      server = "done";
      secondWrite.resolve();
      await second!;
    });
    expect([boardStatus, tableStatus]).toEqual(["done", "done"]);
  } finally {
    staleRead.resolve();
    firstWrite.resolve();
    secondWrite.resolve();
    await act(async () => {
      renderer?.unmount();
    });
    await Promise.all([board.dispose(), table.dispose()]);
    queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
