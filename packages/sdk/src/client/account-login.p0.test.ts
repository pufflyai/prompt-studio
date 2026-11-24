import { expect, test } from "bun:test";
import { createClient } from "./client";

test("Microsoft sign-in cancels a Google-default attempt from a previous host", async () => {
  const requests: Array<{ path: string; method: string }> = [];
  const client = createClient({
    baseUrl: "http://127.0.0.1:19840",
    fetch: Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        const request = new Request(url, init);
        requests.push({ path: new URL(request.url).pathname, method: request.method });
        return Response.json({ id: "previous-host", url: "https://manager.example/v1/native-login" });
      },
      { preconnect: () => {} },
    ),
  });
  await expect(client.account.login(undefined, "microsoft")).rejects.toThrow("Update Prompt Studio");
  expect(requests).toEqual([
    { path: "/v1/account/login", method: "POST" },
    { path: "/v1/account/login/previous-host", method: "DELETE" },
  ]);
});
