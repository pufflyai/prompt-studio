import { expect, test } from "bun:test";
import {
  BACKEND_PROTOCOL_VERSION,
  deserializeBackendError,
  parseWorkerMessage,
  serializeBackendError,
} from "./protocol";

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

test("an error keeps its primitive flags across the worker boundary", () => {
  const thrown = Object.assign(new Error("Stale request"), {
    questionRejected: true,
    status: 409,
    detail: { nested: true },
    code: "stale",
  });
  const serialized = serializeBackendError(thrown);
  const message = parseWorkerMessage({
    v: BACKEND_PROTOCOL_VERSION,
    type: "result",
    invocationId: "i1",
    ok: false,
    error: serialized,
  });
  expect(message).toBeDefined();
  const error = deserializeBackendError(serialized) as Error & Record<string, unknown>;
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe("Stale request");
  expect(error.code).toBe("stale");
  expect(error.questionRejected).toBe(true);
  expect(error.status).toBe(409);
  expect(error.detail).toBeUndefined();
});

test("error data cannot replace an error's prototype or reserved fields", () => {
  const data = JSON.parse('{"__proto__": {"polluted": true}, "message": "replaced", "flag": 1}');
  const error = deserializeBackendError({ name: "Error", message: "original", data }) as Error &
    Record<string, unknown>;
  expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
  expect(error.message).toBe("original");
  expect(error.flag).toBe(1);
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});

test("any thrown value becomes an error the other side accepts", () => {
  const nullStack = Object.assign(new Error("no stack"), { stack: null });
  const odd = Object.assign(new Error("odd"), { name: 7 });
  for (const thrown of [nullStack, odd, Object.create(null), undefined, "text"]) {
    const message = parseWorkerMessage({
      v: BACKEND_PROTOCOL_VERSION,
      type: "result",
      invocationId: "i1",
      ok: false,
      error: serializeBackendError(thrown),
    });
    expect(message).toBeDefined();
  }
});
