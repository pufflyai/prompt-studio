import { expect, test } from "bun:test";
import { applyOrderedOperation, type OrderedEdit, prepareOrderedOperation } from "./ordered-operation";
import { type OrderedTextChange, prepareOrderedText } from "./ordered-text";

test("explicit text updates retain typing from both records' ordered saves", async () => {
  const seed = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: { description: "first\nlast" } }] },
    new Map(),
  );
  const base = applyOrderedOperation(new Map(), seed, "epoch").records[0]!;
  const records = new Map([["card", base]]);
  const update = (replace: string) =>
    prepareOrderedText({
      recordId: "card",
      lifetime: base.lifetime,
      path: ["description"],
      value: base.value,
      replace,
    });
  const firstEdit: OrderedEdit & { texts: OrderedTextChange[] } = {
    recordId: "card",
    changes: [],
    texts: [await update("FIRSTfirst\nlast")],
  };
  const lastEdit: OrderedEdit & { texts: OrderedTextChange[] } = {
    recordId: "card",
    changes: [],
    texts: [await update("first\nLASTlast")],
  };
  const first = await prepareOrderedOperation({ operationId: "first", edits: [firstEdit] }, records);
  const last = await prepareOrderedOperation({ operationId: "last", edits: [lastEdit] }, records);
  for (const operation of [first, last])
    for (const record of applyOrderedOperation(records, operation, "epoch").records)
      records.set(record.recordId, record);
  expect(records.get("card")!.value).toEqual({ description: "FIRSTfirst\nLASTlast" });
});
