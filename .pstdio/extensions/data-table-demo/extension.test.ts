import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("data table demo extension", () => {
  test("contributes a multi-select DataTable mode", () => {
    expect(extension.dataTableRenderers?.services).toMatchObject({
      title: "Service fleet",
      selectionMode: "multiple",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          command: { id: "data-table-demo.services.restart" },
        },
      ],
    });
    expect(extension.panels?.services).toMatchObject({
      region: "main",
      dataTableRenderer: "services",
    });
    expect(extension.modes?.table).toMatchObject({
      id: "pstdio.data-table-demo.table",
      layout: { open: [{ region: "main", panel: "services" }] },
    });
    expect(extension.treeItems?.openTable).toMatchObject({
      action: {
        kind: "command",
        command: "workbench.action.switchMode",
        params: { modeId: "pstdio.data-table-demo.table" },
      },
    });
  });

  test("queries service rows and handles the selected row ids", async () => {
    const notifications: unknown[] = [];
    const queryResult = await extension.commands?.["services.query"]?.run({} as never);
    const restartResult = await extension.commands?.["services.restart"]?.run({
      params: { rowIds: ["gateway", "worker"] },
      notify: {
        toast: async (input: unknown) => {
          notifications.push(input);
        },
      },
    } as never);

    expect(queryResult).toMatchObject({
      rows: [
        { id: "gateway", values: { service: "Gateway" } },
        { id: "worker", values: { service: "Worker" } },
      ],
    });
    expect(restartResult).toEqual({ restartedRowIds: ["gateway", "worker"] });
    expect(notifications).toEqual([
      {
        type: "success",
        title: "Services restarted",
        message: "Restarted 2 services: gateway, worker",
      },
    ]);
  });
});
