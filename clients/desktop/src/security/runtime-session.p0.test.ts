import { describe, expect, test } from "bun:test";
import { createRuntimeLoginUrl } from "./runtime-session";

describe("runtime browser login", () => {
  test("asks the runtime for a single-use login link with the token in a header", async () => {
    const calls: string[] = [];
    const fetchFn = async (input: string, init: RequestInit) => {
      calls.push(`${init.method} ${input} ${new Headers(init.headers).get("authorization")}`);
      return Response.json({ url: "http://127.0.0.1:43127/#browser-login=one-time" });
    };

    const url = await createRuntimeLoginUrl(fetchFn, { origin: "http://127.0.0.1:43127", token: "runtime-secret" });

    expect(url).toBe("http://127.0.0.1:43127/#browser-login=one-time");
    expect(calls).toEqual(["POST http://127.0.0.1:43127/runtime/browser-login Bearer runtime-secret"]);
  });

  test("fails when the runtime refuses the login link", async () => {
    const fetchFn = async () => Response.json({ error: "Unauthorized" }, { status: 401 });

    await expect(
      createRuntimeLoginUrl(fetchFn, { origin: "http://127.0.0.1:43127", token: "runtime-secret" }),
    ).rejects.toThrow("status 401");
  });
});
