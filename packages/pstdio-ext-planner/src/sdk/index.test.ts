import { describe, expect, test } from "bun:test";
import { createPlannerClient } from "./index";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const trackingFetch = () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchFn = ((url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    });
    return Promise.resolve(jsonResponse([]));
  }) as unknown as typeof fetch;

  return { fetchFn, calls };
};

describe("planner SDK client", () => {
  test("pulls tickets through the planner API boundary", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createPlannerClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.pullTickets("proj-1", { ticket_id: "PS-1", force: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/projects/proj-1/extension-commands/pstdio.planner.pullTickets/execute",
    );
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ params: { ticket_id: "PS-1", force: true } });
  });

  test("pushes tickets through the planner API boundary", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createPlannerClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.pushTicket("proj-1", { ticket_id: "PS-1", status: "wip", tags: ["bug"] });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/projects/proj-1/extension-commands/pstdio.planner.pushTicket/execute",
    );
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ params: { ticket_id: "PS-1", status: "wip", tags: ["bug"] } });
  });
});
