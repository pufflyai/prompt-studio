import { expect, test } from "bun:test";
import { createCiResultsClient } from "./ci-results-client";

test("unchanged authenticated results use conditional reads and changed results replace them", async () => {
  let version = 1;
  const conditional: Array<string | null> = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      expect(request.headers.get("authorization")).toBe("Bearer fixture");
      const etag = `"${version}"`;
      conditional.push(request.headers.get("if-none-match"));
      if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });
      return Response.json({ version }, { headers: { etag } });
    },
  });
  try {
    const read = createCiResultsClient("fixture");
    expect(await read(server.url.href)).toEqual({ version: 1 });
    expect(await read(server.url.href)).toEqual({ version: 1 });
    version = 2;
    expect(await read(server.url.href)).toEqual({ version: 2 });
    expect(conditional).toEqual([null, '"1"', '"1"']);
  } finally {
    await server.stop(true);
  }
});

test("an API refusal cannot reuse a previous successful result and reports quota evidence", async () => {
  let denied = false;
  const server = Bun.serve({
    port: 0,
    fetch() {
      if (!denied) return Response.json({ jobs: [] }, { headers: { etag: '"1"' } });
      return Response.json(
        { message: "API rate limit exceeded" },
        { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1234567890" } },
      );
    },
  });
  try {
    const read = createCiResultsClient("fixture");
    await read(server.url.href);
    denied = true;
    await expect(read(server.url.href)).rejects.toThrow(
      "HTTP 403: API rate limit exceeded; remaining=0; reset=1234567890",
    );
  } finally {
    await server.stop(true);
  }
});

test("GitHub's requested pause stops further network polling without supplying cached results", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    fetch() {
      requests++;
      return Response.json({ message: "Secondary rate limit" }, { status: 403, headers: { "retry-after": "60" } });
    },
  });
  try {
    const read = createCiResultsClient("fixture");
    await expect(read(new URL("/run", server.url).href)).rejects.toThrow("HTTP 403");
    await expect(read(new URL("/jobs", server.url).href)).rejects.toThrow("HTTP 403");
    expect(requests).toBe(1);
  } finally {
    await server.stop(true);
  }
});
