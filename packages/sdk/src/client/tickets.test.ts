import { describe, expect, it } from "bun:test";
import { createClient } from "./client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ticket client extensions", () => {
  it("encodes list query filters", async () => {
    const calls: { url: string; method: string }[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return Promise.resolve(jsonResponse([]));
    }) as unknown as typeof fetch;

    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.tickets.list("proj-1", {
      archived: false,
      draft: true,
      status: "wip",
      parent_id: "PS-1",
      shorthand: "PS-2",
      search: "hello",
      tag: ["bug", "urgent"],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/tickets?project_id=proj-1&status=wip&tag=bug&tag=urgent&archived=false&draft=true&parent_id=PS-1&shorthand=PS-2&search=hello",
    );
  });

  it("downloads ticket file content as bytes", async () => {
    const calls: { url: string; method: string; auth?: string | null }[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        auth: new Headers(init?.headers).get("authorization"),
      });
      return Promise.resolve(new Response(Uint8Array.from([1, 2, 3]), { status: 200 }));
    }) as unknown as typeof fetch;

    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn, token: "secret" });

    const result = await client.tickets.getFileContent("ticket-1", "file-1");

    expect(Array.from(result)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      url: "http://test:1234/v1/tickets/ticket-1/files/file-1/content",
      method: "GET",
      auth: "Bearer secret",
    });
  });
});
