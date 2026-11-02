import { expect, test } from "bun:test";
import { textEditingError } from "./text-editing-codec";

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
