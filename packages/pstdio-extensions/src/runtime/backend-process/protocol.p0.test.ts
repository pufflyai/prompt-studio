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
  Object.defineProperty(thrown, "retryable", { get: () => true });
  Object.defineProperty(thrown, "__proto__", { value: null, enumerable: true });
  const serialized = serializeBackendError(thrown);
  expect(serialized.data).toEqual({ questionRejected: true, status: 409 });
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
  expect(error.retryable).toBe(true);
  expect(error.status).toBe(409);
  expect(error.detail).toBeUndefined();
});

test("error data cannot replace an error's prototype or reserved fields", () => {
  const data = JSON.parse(
    '{"__proto__":null,"constructor":"replaced","name":"replaced","message":"replaced",' +
      '"code":"replaced","stack":"replaced","retryable":false,"flag":1}',
  );
  const parsed = parseWorkerMessage({
    v: BACKEND_PROTOCOL_VERSION,
    type: "result",
    invocationId: "i1",
    ok: false,
    error: {
      name: "Error",
      message: "original",
      code: "original_code",
      stack: "original_stack",
      retryable: true,
      data,
    },
  });
  if (!parsed || parsed.type !== "result" || parsed.ok) throw new Error("Expected a parsed error result");
  const error = deserializeBackendError(parsed.error) as Error & Record<string, unknown>;
  expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
  expect(Object.hasOwn(error, "__proto__")).toBe(false);
  expect(error.constructor).toBe(Error);
  expect(error).toMatchObject({
    name: "Error",
    message: "original",
    code: "original_code",
    stack: "original_stack",
    retryable: true,
    flag: 1,
  });
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
