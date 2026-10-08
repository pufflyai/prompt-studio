import { describe, expect, test } from "bun:test";
import { createBrowserSessions, isRuntimeRequestAuthorized } from "./runtime-auth";

const origin = "http://127.0.0.1:43123";

const createSecurity = (now?: () => number) => {
  const browserSessions = createBrowserSessions(now);
  const secret = browserSessions.redeemLoginCode(browserSessions.createLoginCode())!;
  return { browserSessions, secret, security: { browserSessions, origin: () => origin, token: "runtime-secret" } };
};

describe("runtime request authentication", () => {
  test("accepts the browser session as a bearer header", () => {
    const { secret, security } = createSecurity();
    const request = new Request(`${origin}/v1/projects`, { headers: { authorization: `Bearer ${secret}` } });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(true);
  });

  test("accepts the browser session in the WebSocket protocol list", () => {
    const { secret, security } = createSecurity();
    const request = new Request(`${origin}/v1/terminal`, {
      headers: {
        connection: "Upgrade",
        origin,
        "sec-websocket-protocol": `pstdio, pstdio.bearer.${secret}`,
        upgrade: "websocket",
      },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(true);
  });

  test("rejects the browser session sent only as a cookie, even with the runtime Host", () => {
    const { secret, security } = createSecurity();
    // Another local server received the cookie and replays it with a forged Host and no Origin.
    const request = new Request(`${origin}/v1/terminal`, {
      headers: { cookie: `pstdio_runtime_session=${secret}`, host: "127.0.0.1:43123" },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });

  test("rejects a valid browser session sent from a foreign origin", () => {
    const { secret, security } = createSecurity();
    const request = new Request(`${origin}/v1/projects`, {
      headers: { authorization: `Bearer ${secret}`, origin: "http://127.0.0.1:5173" },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });
});

describe("browser sessions", () => {
  test("give a login code the browser session secret, which is not the runtime token", () => {
    const { secret } = createSecurity();

    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secret).not.toBe("runtime-secret");
  });

  test("redeem a login code only once", () => {
    const { browserSessions } = createSecurity();
    const code = browserSessions.createLoginCode();

    expect(browserSessions.redeemLoginCode(code)).toBeString();
    expect(browserSessions.redeemLoginCode(code)).toBeNull();
    expect(browserSessions.redeemLoginCode("unknown-code")).toBeNull();
  });

  test("do not redeem an expired login code", () => {
    let now = 1_000;
    const { browserSessions } = createSecurity(() => now);
    const code = browserSessions.createLoginCode();

    now += 60_000;

    expect(browserSessions.redeemLoginCode(code)).toBeNull();
  });
});
