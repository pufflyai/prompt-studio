import { expect, test } from "bun:test";
import { textEditingError } from "./text-editing-codec";

test("native cancellation and unknown non-string codes stay recoverable", () => {
  const aborted = new DOMException("The operation was aborted", "AbortError");
  expect(typeof aborted.code).toBe("number");
  expect(textEditingError(aborted)).toMatchObject({
    code: "source_unavailable",
    message: "The operation was aborted",
    retryable: true,
  });
  for (const code of [42, null, {}, false])
    expect(textEditingError({ code, message: "Disconnected" })).toMatchObject({
      code: "source_unavailable",
      retryable: true,
    });
});

test("a socket reset remains recoverable while explicit text access refusals keep their policy", () => {
  const disconnected = Object.assign(new Error("Socket connection reset"), { code: "ECONNRESET" });
  expect(textEditingError(disconnected)).toMatchObject({ code: "source_unavailable", retryable: true });
  expect(textEditingError({ code: "source_read_only", message: "Read only", retryable: false })).toMatchObject({
    code: "source_read_only",
    retryable: false,
  });
  expect(textEditingError({ code: "capability_denied", message: "Denied", data: { retryable: false } })).toMatchObject({
    code: "capability_denied",
    retryable: false,
  });
});
