import { describe, expect, test } from "bun:test";
import { createBrowserSessions, isRuntimeRequestAuthorized } from "./runtime-auth";

const origin = "http://127.0.0.1:43123";

const createSecurity = (now?: () => number) => {
  const browserSessions = createBrowserSessions(now);
  const secret = browserSessions.redeemLoginCode(browserSessions.createLoginCode())!;
  return { browserSessions, secret, security: { browserSessions, origin: () => origin, token: "runtime-secret" } };
};

describe("runtime request authentication", () => {
  test("rejects a valid browser session sent from a foreign origin", () => {
    const { secret, security } = createSecurity();
    const request = new Request(`${origin}/v1/projects`, {
      headers: { authorization: `Bearer ${secret}`, origin: "http://127.0.0.1:5173" },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });
});

describe("browser sessions", () => {
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
