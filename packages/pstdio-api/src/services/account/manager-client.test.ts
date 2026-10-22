import { expect, test } from "bun:test";
import { managerOriginSchema, managerRequest } from "./manager-client";

test("an account manager address may include a path", () => {
  expect(managerOriginSchema.parse("https://accounts.example.com")).toBe("https://accounts.example.com");
  expect(managerOriginSchema.parse("https://base.example.com/accounts/")).toBe("https://base.example.com/accounts");
  for (const address of [
    "http://base.example.com/accounts",
    "https://user:secret@base.example.com/accounts",
    "https://base.example.com/accounts?region=eu",
  ])
    expect(managerOriginSchema.safeParse(address).success).toBe(false);
});

test("account manager requests go under the address path and send only its origin", async () => {
  const seen: { path: string; origin: string | null }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      seen.push({ path: new URL(request.url).pathname, origin: request.headers.get("origin") });
      return Response.json({ ok: true });
    },
  });
  try {
    expect(await managerRequest(`${server.url.origin}/accounts`, "/v1/workbenches")).toEqual({ ok: true });
    expect(seen).toEqual([{ path: "/accounts/v1/workbenches", origin: server.url.origin }]);
  } finally {
    await server.stop(true);
  }
});
