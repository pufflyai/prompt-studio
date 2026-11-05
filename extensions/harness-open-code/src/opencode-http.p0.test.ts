import { expect, test } from "bun:test";
import { buildRequestUrl, requestJson } from "./opencode-http";

test("authenticates a private server without passing credentials in the request URL", async () => {
  const endpoint = new URL("http://opencode:private-password@127.0.0.1:4096");
  const result = await requestJson(
    async (input, init) => {
      const url = new URL(String(input));
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      expect(url.searchParams.get("location[directory]")).toBe("/project Å");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${btoa("opencode:private-password")}`);
      return Response.json({ version: "2.2.5" });
    },
    buildRequestUrl(endpoint.href, "/api/info", "/project Å"),
    { method: "GET", headers: {} },
  );
  expect(result.response.ok).toBe(true);
});
