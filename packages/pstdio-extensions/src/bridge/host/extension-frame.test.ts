import { describe, expect, test } from "bun:test";
import {
  buildOpaqueOriginRimlessRedispatch,
  EXTENSION_IFRAME_SANDBOX,
  isOpaqueOriginRimlessMessage,
} from "./extension-frame";

describe("ExtensionFrame sandbox", () => {
  test("does not grant same-origin script access", () => {
    expect(EXTENSION_IFRAME_SANDBOX.split(" ")).not.toContain("allow-same-origin");
  });
});

describe("isOpaqueOriginRimlessMessage", () => {
  const source = {} as MessageEventSource;
  const otherSource = {} as MessageEventSource;
  const data = { action: "RIMLESS/HANDSHAKE_REQUEST" };

  test("returns true for opaque-origin rimless message from matching source", () => {
    expect(isOpaqueOriginRimlessMessage({ origin: "null", source, data }, source)).toBe(true);
  });

  test("returns false when origin is not opaque", () => {
    expect(isOpaqueOriginRimlessMessage({ origin: "https://x", source, data }, source)).toBe(false);
  });

  test("returns false when source does not match", () => {
    expect(isOpaqueOriginRimlessMessage({ origin: "null", source: otherSource, data }, source)).toBe(false);
  });

  test("returns false for non-rimless data", () => {
    expect(isOpaqueOriginRimlessMessage({ origin: "null", source, data: { action: "OTHER" } }, source)).toBe(false);
    expect(isOpaqueOriginRimlessMessage({ origin: "null", source, data: null }, source)).toBe(false);
  });
});

describe("buildOpaqueOriginRimlessRedispatch", () => {
  const source = { fake: "WindowProxy" } as unknown as MessageEventSource;
  const data = { action: "RIMLESS/HANDSHAKE_REQUEST", payload: 1 };
  const synthetic = buildOpaqueOriginRimlessRedispatch({ data, source });

  test("dispatches a plain Event, not a MessageEvent", () => {
    // Firefox rejects WindowProxy values for opaque-origin sandboxed iframes when
    // they pass through MessageEventInit IDL conversion. Using a bare Event with
    // assigned own properties sidesteps that rejection.
    expect(synthetic).toBeInstanceOf(Event);
    expect(synthetic).not.toBeInstanceOf(MessageEvent);
  });

  test("uses the message event type so window 'message' listeners fire", () => {
    expect(synthetic.type).toBe("message");
  });

  test("preserves data and source while clearing origin", () => {
    expect((synthetic as unknown as { data: unknown }).data).toBe(data);
    expect((synthetic as unknown as { source: unknown }).source).toBe(source);
    expect((synthetic as unknown as { origin: unknown }).origin).toBe("");
  });
});
