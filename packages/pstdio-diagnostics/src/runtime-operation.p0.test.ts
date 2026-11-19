import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import {
  finishRuntimeOperation,
  runtimeOperationChannel,
  startRuntimeOperation,
  withRuntimeOperationOrigin,
} from "./runtime-operation";

test("concurrent asynchronous work retains its initiating command", async () => {
  const events: unknown[] = [];
  const sink = (event: unknown) => events.push(event);
  const diagnostics = channel(runtimeOperationChannel);
  diagnostics.subscribe(sink);
  try {
    await Promise.all(
      ["first", "second"].map((name) =>
        withRuntimeOperationOrigin({ kind: "command", name }, async () => {
          await Bun.sleep(name === "first" ? 10 : 1);
          const operation = startRuntimeOperation("database.query", { statement: "SELECT", queryHash: name });
          await Bun.sleep(1);
          finishRuntimeOperation(operation, { rows: 3 });
        }),
      ),
    );
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origin: expect.objectContaining({ name: "first" }), queryHash: "first", rows: 3 }),
        expect.objectContaining({ origin: expect.objectContaining({ name: "second" }), queryHash: "second", rows: 3 }),
      ]),
    );
  } finally {
    diagnostics.unsubscribe(sink);
  }
});

test("operation tracing stays dormant without a subscriber", () => {
  expect(startRuntimeOperation("database.query", { statement: "SELECT" })).toBeUndefined();
  finishRuntimeOperation(undefined, { rows: 0 });
});
