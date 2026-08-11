import { describe, expect, test } from "bun:test";
import { provisionRuntimeSession } from "./runtime-session";

describe("runtime browser session", () => {
  test("clears the ephemeral session and provisions the HttpOnly cookie through the runtime", async () => {
    const calls: string[] = [];
    const session = {
      clearStorageData: async (options: { storages: Array<"cookies"> }) => {
        calls.push(`clear:${options.storages.join(",")}`);
      },
      fetch: async (input: string, init: RequestInit) => {
        calls.push(`fetch:${input}:${new Headers(init.headers).get("authorization")}`);
        return new Response(null, { status: 204 });
      },
      cookies: {
        get: async () => [{ httpOnly: true, sameSite: "strict", secure: false, value: "runtime-secret" }],
      },
    };

    await provisionRuntimeSession(session, {
      origin: "http://127.0.0.1:43127",
      token: "runtime-secret",
    });

    expect(calls).toEqual([
      "clear:cookies",
      "fetch:http://127.0.0.1:43127/runtime/browser-session:Bearer runtime-secret",
    ]);
  });

  test("fails closed when the runtime does not provision the expected protected cookie", async () => {
    const session = {
      clearStorageData: async () => {},
      fetch: async () => new Response(null, { status: 204 }),
      cookies: { get: async () => [{ httpOnly: false, sameSite: "lax", secure: false, value: "runtime-secret" }] },
    };

    await expect(
      provisionRuntimeSession(session, { origin: "http://127.0.0.1:43127", token: "runtime-secret" }),
    ).rejects.toThrow("protected runtime session cookie");
  });
});
