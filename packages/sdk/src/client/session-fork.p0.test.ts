import { expect, test } from "bun:test";
import { createClient } from "./client";

test("fork returns the new session without submitting a prompt", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = createClient({
    baseUrl: "http://session-api.test",
    fetch: (async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ id: "fork", originalSessionId: "source" }, { status: 201 });
    }) as typeof fetch,
  });
  expect(await client.sessions.fork("source")).toMatchObject({ id: "fork", originalSessionId: "source" });
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("http://session-api.test/v1/sessions/source/fork");
  expect(calls[0].init?.method).toBe("POST");
  expect(calls[0].init?.body).toBeUndefined();
});
