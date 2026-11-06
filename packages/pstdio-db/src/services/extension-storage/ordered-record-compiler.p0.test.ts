import { expect, test } from "bun:test";
import { applyOrderedOperation, type OrderedRecord } from "pstdio-sync/records";
import { compileOrderedGroup } from "./ordered-record-compiler";

test("restoring just a record value retains its saved asset and independent shared channel", async () => {
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "image/png" };
  const record: OrderedRecord = {
    recordId: "card",
    deleted: true,
    lifetime: "initial",
    stamps: {},
    value: { value: { old: true }, asset, shared: { kind: "map", value: { retained: true } } },
  };
  const records = new Map([[record.recordId, record]]);
  const operation = await compileOrderedGroup(
    { operationId: "restore", edits: [{ recordId: "card", deleted: false, replace: { fresh: true } }] },
    records,
  );
  const restored = applyOrderedOperation(records, operation, "epoch").records[0]!;
  expect(restored.value).toEqual({ value: { fresh: true }, asset, shared: { kind: "map", value: { retained: true } } });
});

test("a bound file cannot acquire a second asset authority through an ordinary record save", async () => {
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "text/plain" };
  const record: OrderedRecord = {
    recordId: "file",
    deleted: false,
    lifetime: "initial",
    stamps: {},
    value: {
      value: { path: "note.md" },
      asset,
      nativeSources: { ["a".repeat(64)]: { asset, baseline: "AA==", lifetime: "initial" } },
    },
  };
  await expect(
    compileOrderedGroup(
      { operationId: "replacement", edits: [{ recordId: "file", asset: { ...asset, sha256: "b".repeat(64) } }] },
      new Map([[record.recordId, record]]),
    ),
  ).rejects.toThrow("through its text source");
});

test("a late save of retired text refuses its atomic group instead of wedging a fresh field history", async () => {
  const { applyBoundedOrderedOperation } = await import("pstdio-sync/records");
  const declarations = [{ prefix: "card", fields: ["/description"] }];
  const views = new Map<string, OrderedRecord>();
  const apply = async (group: Parameters<typeof compileOrderedGroup>[0]) => {
    const operation = await compileOrderedGroup(group, views, declarations);
    for (const record of applyOrderedOperation(views, operation, "epoch").records) views.set(record.recordId, record);
    return operation;
  };
  await apply({ operationId: "start-text", edits: [{ recordId: "card", replace: { description: "original" } }] });
  const late = await compileOrderedGroup(
    {
      operationId: "late-text",
      edits: [
        { recordId: "card", set: { "/description": "old typing" } },
        { recordId: "side-effect", replace: true },
      ],
    },
    views,
    declarations,
  );
  await apply({ operationId: "remove-text", edits: [{ recordId: "card", unset: ["/description"] }] });
  await apply({ operationId: "readd-text", edits: [{ recordId: "card", set: { "/description": "original" } }] });
  const result = await applyBoundedOrderedOperation(views, late, "epoch");
  expect(result.decision.state).toBe("refused");
  expect(result.records).toEqual([]);
  expect(views.get("card")!.value).toMatchObject({ value: { description: "original" } });
});

test("a complete retired empty-genesis text source cannot join a readded field with identical bytes", async () => {
  const { applyBoundedOrderedOperation, prepareOrderedOperation } = await import("pstdio-sync/records");
  const Y = await import("yjs");
  const declarations = [{ prefix: "card", fields: ["/description"] }];
  const views = new Map<string, OrderedRecord>();
  const apply = async (group: Parameters<typeof compileOrderedGroup>[0]) => {
    const operation = await compileOrderedGroup(group, views, declarations);
    for (const record of applyOrderedOperation(views, operation, "epoch").records) views.set(record.recordId, record);
  };
  await apply({ operationId: "full-start", edits: [{ recordId: "card", replace: { description: "original" } }] });
  const stale = await compileOrderedGroup(
    { operationId: "full-late", edits: [{ recordId: "card", set: { "/description": "old typing" } }] },
    views,
    declarations,
  );
  const document = new Y.Doc();
  let update: string;
  try {
    Y.applyUpdate(document, Buffer.from(views.get("card")!.texts!["/value/description"]!.state, "base64"));
    Y.applyUpdate(document, Buffer.from(stale.edits[0]!.texts![0]!.update, "base64"));
    update = Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64");
  } finally {
    document.destroy();
  }
  const full = await prepareOrderedOperation(
    {
      operationId: stale.operationId,
      edits: [{ recordId: "card", changes: [], texts: [{ ...stale.edits[0]!.texts![0]!, update }] }],
    },
    views,
  );
  await apply({ operationId: "full-remove", edits: [{ recordId: "card", unset: ["/description"] }] });
  await apply({ operationId: "full-readd", edits: [{ recordId: "card", set: { "/description": "original" } }] });
  const result = await applyBoundedOrderedOperation(views, full, "epoch");
  expect(result.decision.state).toBe("refused");
  expect(result.records).toEqual([]);
});
