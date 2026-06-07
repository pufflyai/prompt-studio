import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { DataRendererQueryState } from "pstdio-workbench/core";
import {
  buildExtensionDataRendererContribution,
  type ExtensionDataRendererRecord,
  unwrapCommandOutcome,
} from "./extension-data-renderer-contributions";

const record: ExtensionDataRendererRecord = {
  id: "pstdio-core-tickets.tickets",
  extensionId: "pstdio.pstdio-core-tickets",
  title: "Tickets",
  resourceKind: "ticket",
  queryCommandId: "pstdio-core-tickets.query-tickets",
  updateAttributeCommandId: "pstdio-core-tickets.set-status",
  attributes: [{ id: "status", label: "Status", type: { kind: "string" } }],
};

const queryState: DataRendererQueryState = {
  settings: {
    viewMode: "board",
    columnGrouping: "status",
    rowGrouping: "none",
    ordering: { attributeId: "manual", direction: "asc" },
    displayProperties: [],
  },
  filters: {},
};

const queryResult = {
  rows: [{ id: "t1", title: "T-1 First", resource: { type: "ticket", id: "t1" }, attributes: { status: "s-todo" } }],
  attributes: [
    {
      id: "status",
      label: "Status",
      type: { kind: "enum", options: [{ value: "s-todo", label: "Todo", color: "blue" }] },
    },
  ],
  boardColumnConfigs: { "s-todo": { color: "blue", canDragIn: true, canDragOut: false } },
};

describe("unwrapCommandOutcome", () => {
  test("returns outcome.value when ok", () => {
    const response = {
      commandId: "c",
      extensionId: "e",
      outcome: { ok: true, status: "success", value: { rows: [] } },
    } as CommandExecuteResponse;
    expect(unwrapCommandOutcome(response)).toEqual({ rows: [] });
  });

  test("throws with the failure reason when not ok", () => {
    const response = {
      commandId: "c",
      extensionId: "e",
      outcome: { ok: false, status: "error", reason: "boom" },
    } as CommandExecuteResponse;
    expect(() => unwrapCommandOutcome(response)).toThrow("boom");
  });
});

describe("buildExtensionDataRendererContribution", () => {
  test("queries via the query command and exposes rows, live attributes, and board configs", async () => {
    const calls: Array<{ commandId: string; body: { params?: unknown } }> = [];
    const executeCommand = async (commandId: string, body: { params?: unknown }) => {
      calls.push({ commandId, body });
      return commandId === record.queryCommandId ? queryResult : undefined;
    };

    const { contribution } = buildExtensionDataRendererContribution({ record, executeCommand });
    const rows = await contribution.executeQuery(queryState);

    expect(calls[0]).toEqual({ commandId: record.queryCommandId, body: { params: queryState } });
    expect(rows).toEqual(queryResult.rows as never);
    const attributes = contribution.attributes;
    expect(typeof attributes).toBe("object");
    expect(attributes).toHaveProperty("getSnapshot");
    expect((attributes as { getSnapshot: () => typeof queryResult.attributes }).getSnapshot()[0]?.type).toEqual({
      kind: "enum",
      options: [{ value: "s-todo", label: "Todo", color: "blue" }],
    });
    expect(contribution.getBoardColumnConfig?.("s-todo")).toEqual({
      color: "blue",
      canDragIn: true,
      canDragOut: false,
      canCreate: undefined,
    });
  });

  test("routes attribute changes through the update command and refreshes", async () => {
    const calls: Array<{ commandId: string; body: { params?: unknown } }> = [];
    const executeCommand = async (commandId: string, body: { params?: unknown }) => {
      calls.push({ commandId, body });
      return undefined;
    };

    const { contribution } = buildExtensionDataRendererContribution({ record, executeCommand });

    let refreshed = 0;
    contribution.subscribe?.(() => {
      refreshed += 1;
    });

    await contribution.onAttributeChange?.("t1", "status", "s-done");

    expect(calls.at(-1)).toEqual({
      commandId: record.updateAttributeCommandId!,
      body: { params: { rowId: "t1", attributeId: "status", value: "s-done" } },
    });
    expect(refreshed).toBe(1);
  });

  test("omits mutation handlers when no command is declared", () => {
    const executeCommand = async () => undefined;
    const { contribution } = buildExtensionDataRendererContribution({
      record: { id: "x", extensionId: "e", title: "X", queryCommandId: "x.query" },
      executeCommand,
    });

    expect(contribution.onAttributeChange).toBeUndefined();
    expect(contribution.onReorder).toBeUndefined();
    expect(contribution.onColumnAction).toBeUndefined();
  });
});
