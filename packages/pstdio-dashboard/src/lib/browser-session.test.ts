import { describe, expect, it } from "bun:test";
import { browserSessionWebSocketProtocols, takeBrowserLoginCode } from "./browser-session";

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
