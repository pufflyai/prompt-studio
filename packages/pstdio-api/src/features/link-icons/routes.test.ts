import { afterAll, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import { createLinkIconFetcher } from "./link-icon-fetcher";
import { isPublicAddress } from "./public-address";
import { createLinkIconRoutes } from "./routes";

type Routes = Record<string, (request: Request) => Response | Promise<Response>>;

const servers: ReturnType<typeof Bun.serve>[] = [];
afterAll(() => {
  for (const server of servers) server.stop(true);
});

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngDataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
const image = (type = "image/png", body: BodyInit = png) => new Response(body, { headers: { "content-type": type } });
const page = (head: string) =>
  new Response(`<!doctype html><html><head><title>Site</title>${head}</head><body>Hello</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

const site = (routes: Routes, hostname = "127.0.0.1") => {
  const requests: string[] = [];
  const server = Bun.serve({
    hostname,
    port: 0,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      requests.push(path);
      return routes[path]?.(request) ?? new Response("Not found", { status: 404 });
    },
  });
  servers.push(server);
  return { url: (path: string) => new URL(path, server.url).toString(), requests };
};

// Tests reach their own servers on 127.0.0.1. Every other address follows the production rule.
const testAddresses = (address: string) => address === "127.0.0.1" || isPublicAddress(address);

const linkIcons = (fetcher = createLinkIconFetcher({ isAllowedAddress: testAddresses })) => {
  const app = new OpenAPIHono<AppBindings>();
  app.route("/v1", createLinkIconRoutes(fetcher));
  return async (url: string) => {
    const response = await app.request(`/v1/link-icons?url=${encodeURIComponent(url)}`);
    return { status: response.status, body: await response.json() };
  };
};

test("returns the icon the page declares, resolved against the final page URL", async () => {
  const server = site({
    "/docs/start": () => redirect("/docs/guide/"),
    "/docs/guide/": () =>
      page(
        '<link rel="stylesheet" href="/site.css"><link rel="mask-icon" href="/mask.svg"><link rel="icon" href="icon.svg">',
      ),
    "/docs/guide/icon.svg": () => image("image/svg+xml; charset=utf-8", "<svg xmlns='http://www.w3.org/2000/svg'/>"),
  });

  const result = await linkIcons()(server.url("/docs/start"));

  expect(result).toEqual({
    status: 200,
    body: { data_url: `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg'/>")}` },
  });
  expect(server.requests).toEqual(["/docs/start", "/docs/guide/", "/docs/guide/icon.svg"]);
});

test("tries each declared icon in order before the site favicon", async () => {
  const server = site({
    "/": () => page('<link rel="shortcut icon" href="/missing.ico"><link rel="apple-touch-icon" href="/touch.png">'),
    "/touch.png": () => image(),
  });

  expect(await linkIcons()(server.url("/"))).toEqual({ status: 200, body: { data_url: pngDataUrl } });
  expect(server.requests).toEqual(["/", "/missing.ico", "/touch.png"]);
});

test("falls back to /favicon.ico when the page declares no icon", async () => {
  const server = site({
    "/article": () => page('<meta name="description" content="No icon">'),
    "/favicon.ico": () => image("image/x-icon"),
  });

  const result = await linkIcons()(server.url("/article"));

  expect(result).toEqual({
    status: 200,
    body: { data_url: `data:image/x-icon;base64,${btoa(String.fromCharCode(...png))}` },
  });
});

test("rejects responses that are not images", async () => {
  const server = site({
    "/": () => page('<link rel="icon" href="/icon">'),
    "/icon": () => page(""),
    "/favicon.ico": () => new Response("<svg/>", { headers: { "content-type": "text/plain" } }),
  });

  expect(await linkIcons()(server.url("/"))).toEqual({ status: 404, body: { error: "No icon found." } });
});

test("rejects oversized icons", async () => {
  const server = site({ "/": () => page(""), "/favicon.ico": () => image("image/png", new Uint8Array(200_000)) });

  expect((await linkIcons()(server.url("/"))).status).toBe(404);
});

test("gives up on sites that do not answer in time", async () => {
  const slow = async () => {
    await Bun.sleep(2_000);
    return image();
  };
  const server = site({ "/": slow, "/favicon.ico": slow });
  const started = performance.now();

  const result = await linkIcons(createLinkIconFetcher({ isAllowedAddress: testAddresses, timeoutMs: 100 }))(
    server.url("/"),
  );

  expect(result.status).toBe(404);
  expect(performance.now() - started).toBeLessThan(1_500);
});

test("one time limit covers every redirect and icon of a site", async () => {
  const step = (response: () => Response) => async () => {
    await Bun.sleep(80);
    return response();
  };
  const server = site({
    "/": step(() => redirect("/b")),
    "/b": step(() => redirect("/c")),
    "/c": step(() => page('<link rel="icon" href="/icon.png">')),
    "/icon.png": step(() => image()),
  });

  const result = await linkIcons(createLinkIconFetcher({ isAllowedAddress: testAddresses, timeoutMs: 150 }))(
    server.url("/"),
  );

  expect(result.status).toBe(404);
});

test("reads pages without slow parsing", async () => {
  const server = site({
    "/": () => new Response("<!--".repeat(64 * 1024), { headers: { "content-type": "text/html" } }),
    "/favicon.ico": () => image(),
  });
  const started = performance.now();

  expect((await linkIcons()(server.url("/"))).body).toEqual({ data_url: pngDataUrl });
  expect(performance.now() - started).toBeLessThan(1_000);
});

test("asks for uncompressed responses, sends no cookies, and ignores compressed answers", async () => {
  const headers: Headers[] = [];
  const gzip = (body: string | Uint8Array<ArrayBuffer>, type: string) => (request: Request) => {
    headers.push(request.headers);
    return new Response(Bun.gzipSync(typeof body === "string" ? new TextEncoder().encode(body) : body), {
      headers: { "content-type": type, "content-encoding": "gzip" },
    });
  };
  const server = site({
    "/": gzip('<html><head><link rel="icon" href="/declared.png"></head></html>', "text/html"),
    "/declared.png": () => image(),
    "/favicon.ico": gzip(png, "image/png"),
  });

  expect((await linkIcons()(server.url("/"))).status).toBe(404);
  expect(server.requests).toEqual(["/", "/favicon.ico"]);
  for (const sent of headers) {
    expect(sent.get("accept-encoding")).toBe("identity");
    expect(sent.get("cookie")).toBeNull();
  }
});

test("refuses redirects to private network addresses", async () => {
  const internal = site({ "/icon.png": () => image() }, "::1");
  const server = site({
    "/": () => page('<link rel="icon" href="/icon.png">'),
    "/icon.png": () => redirect(internal.url("/icon.png")),
    "/favicon.ico": () => redirect(internal.url("/icon.png")),
  });

  expect((await linkIcons()(server.url("/"))).status).toBe(404);
  expect(server.requests).toEqual(["/", "/icon.png", "/favicon.ico"]);
  expect(internal.requests).toEqual([]);
});

test("refuses local network sites, credentials and other schemes", async () => {
  const server = site({ "/": () => page(""), "/favicon.ico": () => image() });
  const credentials = new URL(server.url("/"));
  credentials.username = "user";
  credentials.password = "secret";

  expect((await linkIcons(createLinkIconFetcher())(server.url("/"))).status).toBe(404);
  const icons = linkIcons();
  for (const url of [credentials.toString(), `ftp://127.0.0.1/`, "not a url"])
    expect((await icons(url)).status).toBe(404);
  expect(server.requests).toEqual([]);
});

test("caches icons and misses per site", async () => {
  const found = site({ "/": () => page(""), "/favicon.ico": () => image() });
  const missing = site({ "/": () => page("") });
  const icons = linkIcons();

  expect((await icons(found.url("/a"))).body).toEqual({ data_url: pngDataUrl });
  expect((await icons(found.url("/b"))).body).toEqual({ data_url: pngDataUrl });
  expect((await icons(missing.url("/a"))).status).toBe(404);
  expect((await icons(missing.url("/b"))).status).toBe(404);

  expect(found.requests).toEqual(["/a", "/favicon.ico"]);
  expect(missing.requests).toEqual(["/a", "/favicon.ico"]);
});
