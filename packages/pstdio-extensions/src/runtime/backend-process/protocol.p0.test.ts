import { expect, test } from "bun:test";
import { BACKEND_PROTOCOL_VERSION, parseWorkerMessage, serializeBackendError } from "./protocol";

test("a worker result preserves a failure without an available stack", () => {
  const error = Object.assign(new Error("cannot finish"), { stack: null });
  const result = {
    v: BACKEND_PROTOCOL_VERSION,
    type: "result",
    invocationId: "invocation",
    ok: false,
    error: serializeBackendError(error),
  };
  expect(parseWorkerMessage(result)).toMatchObject({ error: { name: "Error", message: "cannot finish" } });
});

test("an error reason with no plain text representation gets a fallback", () => {
  expect(serializeBackendError(Object.create(null))).toMatchObject({ name: "Error", message: expect.any(String) });
});
