import { describe, expect, it } from "bun:test";
import { browserSessionStorageKey, browserSessionWebSocketProtocols, takeBrowserLoginCode } from "./browser-session";

it("scopes credentials to the selected API runtime, including its port", () => {
  const page = "http://localhost:19840/projects";
  expect(browserSessionStorageKey("/", page)).toBe(browserSessionStorageKey("http://localhost:19840", page));
  expect(browserSessionStorageKey("http://localhost:19841", page)).not.toBe(browserSessionStorageKey("/", page));
  expect(browserSessionStorageKey("ws://localhost:19840/v1/terminals", page)).toBe(browserSessionStorageKey("/", page));
});

describe("browser login links", () => {
  it("takes the single-use code out of the URL fragment", () => {
    expect(takeBrowserLoginCode("#browser-login=one-time")).toEqual({ code: "one-time", hash: "" });
  });

  it("keeps other fragment values", () => {
    expect(takeBrowserLoginCode("#browser-login=one-time&panel=terminal")).toEqual({
      code: "one-time",
      hash: "#panel=terminal",
    });
  });

  it("leaves a fragment without a code unchanged", () => {
    expect(takeBrowserLoginCode("#panel=terminal")).toEqual({ code: null, hash: "#panel=terminal" });
  });
});

describe("browser session WebSocket protocols", () => {
  it("offers the plain protocol first so the server never echoes the secret", () => {
    expect(browserSessionWebSocketProtocols("browser-secret")).toEqual(["pstdio", "pstdio.bearer.browser-secret"]);
  });

  it("offers no protocols without a session", () => {
    expect(browserSessionWebSocketProtocols(undefined)).toBeUndefined();
  });
});
