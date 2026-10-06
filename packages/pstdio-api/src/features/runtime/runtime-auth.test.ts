import { describe, expect, test } from "bun:test";
import { createBrowserSessions, isRuntimeRequestAuthorized, RUNTIME_AUTH_COOKIE } from "./runtime-auth";

const origin = "http://127.0.0.1:43123";

const createSecurity = (now?: () => number) => {
  const browserSessions = createBrowserSessions(now);
  return { browserSessions, security: { browserSessions, origin: () => origin, token: "runtime-secret" } };
};

const sessionCookieValue = (cookie: string) => cookie.split(";", 1)[0]!.slice(`${RUNTIME_AUTH_COOKIE}=`.length);

describe("runtime request authentication", () => {
  test("authenticates an exact-origin WebSocket handshake through the HttpOnly session cookie", () => {
    const { browserSessions, security } = createSecurity();
    const request = new Request(`${origin}/v1/terminal`, {
      headers: {
        connection: "Upgrade",
        cookie: `${RUNTIME_AUTH_COOKIE}=${sessionCookieValue(browserSessions.cookie())}`,
        origin,
        upgrade: "websocket",
      },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(true);
  });

  test("rejects a cookie sent from a foreign origin", () => {
    const { browserSessions, security } = createSecurity();
    const request = new Request(`${origin}/v1/terminal`, {
      headers: {
        cookie: `${RUNTIME_AUTH_COOKIE}=${sessionCookieValue(browserSessions.cookie())}`,
        origin: "http://attacker.example",
      },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });

  test("does not accept the runtime token as a browser cookie", () => {
    const { security } = createSecurity();
    const request = new Request(`${origin}/v1/projects`, {
      headers: { cookie: `${RUNTIME_AUTH_COOKIE}=runtime-secret`, origin },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });
});

describe("browser sessions", () => {
  test("create a non-persistent cookie with no JavaScript access that is not the runtime token", () => {
    const { browserSessions } = createSecurity();
    const cookie = browserSessions.cookie();

    expect(cookie).toMatch(new RegExp(`^${RUNTIME_AUTH_COOKIE}=[A-Za-z0-9_-]{43}; Path=/; HttpOnly; SameSite=Strict$`));
    expect(sessionCookieValue(cookie)).not.toBe("runtime-secret");
  });

  test("redeem a login code only once", () => {
    const { browserSessions } = createSecurity();
    const code = browserSessions.createLoginCode();

    expect(browserSessions.redeemLoginCode(code)).toBe(true);
    expect(browserSessions.redeemLoginCode(code)).toBe(false);
    expect(browserSessions.redeemLoginCode("unknown-code")).toBe(false);
  });

  test("do not redeem an expired login code", () => {
    let now = 1_000;
    const { browserSessions } = createSecurity(() => now);
    const code = browserSessions.createLoginCode();

    now += 60_000;

    expect(browserSessions.redeemLoginCode(code)).toBe(false);
  });
});
