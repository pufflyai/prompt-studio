import { describe, expect, test } from "bun:test";
import type { DataTableRendererRow } from "../../../core";
import {
  buildDataTableRendererData,
  resolveDataTableRendererColumns,
  resolveDataTableRendererSelectionActions,
  resolveDataTableRendererStorageKey,
} from "./data-table-view-model";

describe("data table renderer view model", () => {
  test("prefers query columns, then contribution columns, then inferred value keys", () => {
    const rows = [{ id: "one", values: { name: "API", score: 92 } }];
    expect(resolveDataTableRendererColumns({ rows, columns: [{ id: "score" }] }, [{ id: "name" }])).toEqual([
      { id: "score" },
    ]);
    expect(resolveDataTableRendererColumns({ rows }, [{ id: "name" }])).toEqual([{ id: "name" }]);
    expect(resolveDataTableRendererColumns({ rows })).toEqual([{ id: "name" }, { id: "score" }]);
  });

  test("keeps row metadata outside visible values and preserves descriptor order", () => {
    const row = { id: "one", values: { score: 92, name: "API", ignored: true } };
    const model = buildDataTableRendererData([row], [{ id: "name" }, { id: "score" }]);

    expect(Object.keys(model.data[0]!)).toEqual(["name", "score"]);
    expect(model.data[0]).toEqual({ name: "API", score: 92 });
    expect(model.rowByData.get(model.data[0]!)).toBe(row);
  });

  test("maps selected table data back to the original renderer rows", () => {
    const rows = [
      { id: "one", values: { name: "API" } },
      { id: "two", values: { name: "Worker" } },
    ];
    const model = buildDataTableRendererData(rows, [{ id: "name" }]);
    const calls: DataTableRendererRow[][] = [];
    const actions = resolveDataTableRendererSelectionActions(
      [
        {
          id: "restart",
          label: "Restart",
          destructive: true,
          run: (selectedRows) => {
            calls.push(selectedRows);
          },
        },
      ],
      model.rowByData,
    );

    actions[0]?.onSelect([model.data[1]!, { name: "Stale" }, model.data[0]!]);

    expect(actions[0]).toMatchObject({ label: "Restart", destructive: true });
    expect(calls).toEqual([[rows[1], rows[0]]]);
  });

  test("scopes persisted controls to the renderer, placement, and resource", () => {
    expect(
      resolveDataTableRendererStorageKey("health", {
        instanceId: "health:1",
        panelId: "health.view",
        closable: false,
        resource: { kind: "project", uri: "pstdio://project/one", id: "one" },
      }),
    ).toBe("pstdio:workbench:dataTableRenderer:health:health:1:pstdio://project/one");
  });
});
