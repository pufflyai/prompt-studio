import { afterAll, describe, expect, test } from "bun:test";
import { checkUrls, externalUrls } from "./docs-external-links";

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/ok") return new Response("ok");
    if (pathname === "/moved") return Response.redirect(new URL("/ok", request.url), 301);
    // Some sites reject HEAD requests but serve GET.
    if (pathname === "/get-only")
      return request.method === "HEAD" ? new Response(null, { status: 405 }) : new Response("ok");
    if (pathname === "/bot-wall") return new Response("forbidden", { status: 403 });
    return new Response("missing", { status: 404 });
  },
});
afterAll(() => server.stop(true));

const url = (path: string) => new URL(path, server.url).toString();

describe("external URLs", () => {
  test("skips links the offline check covers, local addresses, and placeholders", () => {
    const text = [
      "[site](https://prompt.studio/docs/guides/sdk/client/)",
      "[repo](https://github.com/pufflyai/prompt-studio/blob/main/README.md)",
      "[issue](https://github.com/pufflyai/prompt-studio/issues/1)",
      "[local](http://127.0.0.1:19840/api) [host](http://localhost:5173) [example](https://example.com/x)",
      "[template](https://github.com/<owner>/<repo>)",
      "[bun](https://bun.sh/docs)",
    ].join("\n");

    expect(externalUrls([{ file: "README.md", text }])).toEqual(
      new Map([
        ["https://github.com/pufflyai/prompt-studio/issues/1", ["README.md:3"]],
        ["https://bun.sh/docs", ["README.md:6"]],
      ]),
    );
  });

  test("reports unreachable pages with every place that links to them", async () => {
    const urls = new Map([
      [url("/ok"), ["a.md:1"]],
      [url("/moved"), ["a.md:2"]],
      [url("/get-only"), ["a.md:3"]],
      [url("/gone"), ["a.md:4", "b.md:9"]],
      [url("/bot-wall"), ["a.md:5"]],
    ]);

    expect(await checkUrls(urls)).toEqual({
      failures: [{ url: url("/gone"), status: "HTTP 404", places: ["a.md:4", "b.md:9"] }],
      unverified: [{ url: url("/bot-wall"), status: "HTTP 403", places: ["a.md:5"] }],
    });
  });
});
