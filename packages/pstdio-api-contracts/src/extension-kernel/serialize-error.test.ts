import { expect, test } from "bun:test";
import { serializeCommandError } from "./serialize-error";

test("serialized command errors retain JSON causes and nested error details", () => {
  const inner = Object.assign(new Error("Storage changed", { cause: { revision: 2 } }), { code: "stale_revision" });
  const error = new Error("Could not save", { cause: inner });
  const serialized = serializeCommandError(error);
  expect(serialized).toMatchObject({
    message: "Could not save",
    cause: { message: "Storage changed", code: "stale_revision", cause: { revision: 2 } },
  });
  expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
});

test("a cyclic error cause remains serializable", () => {
  const error = new Error("Loop");
  error.cause = error;
  expect(serializeCommandError(error)).toMatchObject({ message: "Loop", cause: "[Circular]" });
});

test("repeated values in an error cause are not cycles", () => {
  const detail = { revision: 2 };
  const error = new Error("Changed", { cause: { before: detail, after: detail } });
  expect(serializeCommandError(error).cause).toEqual({ before: { revision: 2 }, after: { revision: 2 } });
});
