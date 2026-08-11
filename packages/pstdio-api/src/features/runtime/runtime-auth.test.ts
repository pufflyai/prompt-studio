import { describe, expect, test } from "bun:test";
import { isRuntimeRequestAuthorized, RUNTIME_AUTH_COOKIE, runtimeSessionCookie } from "./runtime-auth";

const origin = "http://127.0.0.1:43123";
const security = { origin: () => origin, token: "runtime-secret" };

describe("runtime request authentication", () => {
  test("authenticates an exact-origin WebSocket handshake through the HttpOnly session cookie", () => {
    const request = new Request(`${origin}/v1/terminal`, {
      headers: {
        connection: "Upgrade",
        cookie: `${RUNTIME_AUTH_COOKIE}=runtime-secret`,
        origin,
        upgrade: "websocket",
      },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(true);
  });

  test("rejects a cookie sent from a foreign origin", () => {
    const request = new Request(`${origin}/v1/terminal`, {
      headers: {
        cookie: `${RUNTIME_AUTH_COOKIE}=runtime-secret`,
        origin: "http://attacker.example",
      },
    });

    expect(isRuntimeRequestAuthorized(request, security)).toBe(false);
  });

  test("creates a non-persistent browser cookie with no JavaScript access", () => {
    expect(runtimeSessionCookie("runtime-secret")).toBe(
      `${RUNTIME_AUTH_COOKIE}=runtime-secret; Path=/; HttpOnly; SameSite=Strict`,
    );
  });
});
