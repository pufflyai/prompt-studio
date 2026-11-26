import { afterEach, expect, test } from "bun:test";
import { createPreviewRoutes } from "./preview-resources";

const servers: { stop(close?: boolean): unknown }[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];

test("repeated concurrent opens and cleanup retain the other preview's route and certificate", async () => {
  const resources = new Map<string, any>();
  const certificates = new Map<string, any>();
  const entries = new Map<string, any>();
  const running = new Set(ids);
  async function kubernetes(request: Request, url: URL) {
    if (request.method === "POST") {
      const value = (await request.json()) as any;
      const key = url.pathname + "/" + value.metadata.name;
      if (resources.has(key)) return new Response(null, { status: 409 });
      resources.set(key, value);
      return Response.json(value);
    }
    resources.delete(url.pathname);
    return Response.json({});
  }
  function pods(url: URL) {
    const id = url.searchParams.get("labelSelector")!.split("=")[1];
    return Response.json({
      items: running.has(id) ? [{ metadata: { name: "pod-" + id, uid: id }, status: { phase: "Running" } }] : [],
    });
  }
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/pods")) return pods(url);
      if (url.pathname.startsWith("/kube/")) return kubernetes(request, url);
      const isCertificate = url.pathname.includes("/certificates");
      const records = isCertificate ? certificates : entries;
      if (request.method === "POST") {
        const name = url.searchParams.get(isCertificate ? "certificateId" : "certificateMapEntryId")!;
        if (records.has(name)) return new Response(null, { status: 409 });
        records.set(name, { name: url.pathname + "/" + name, ...((await request.json()) as object) });
        return Response.json({ done: true });
      }
      if (request.method === "DELETE") {
        const existed = records.delete(url.pathname.split("/").at(-1)!);
        return Response.json({ done: true }, { status: existed ? 200 : 404 });
      }
      return Response.json({ certificates: [...certificates.values()] });
    },
  });
  servers.push(server);
  const api =
    (prefix: string) =>
    (path: string, method = "GET", body?: unknown) =>
      fetch(server.url.origin + prefix + path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const routes = createPreviewRoutes(
    {
      project: "test",
      namespace: "test",
      domain: "preview.example.test",
      certificateMap: "test",
      gateway: "test",
      securityPolicy: "test",
    },
    api("/kube"),
    api("/google/"),
  );
  await Promise.all(ids.map((id) => routes.ensure(id, Date.now() + 60_000)));
  const initialRoutes = [...resources.values()].filter((r) => r.kind === "HTTPRoute");
  expect(initialRoutes.map((r) => r.spec.hostnames[0]).sort()).toEqual(ids.map((id) => `${id}.preview.example.test`));
  await routes.ensure(ids[0], Date.now() + 120_000);
  expect(resources.size).toBe(10);
  expect(certificates.size).toBe(2);
  const expiry = certificates.get("pstdio-preview-" + ids[0]).labels["preview-expires"];
  expect(Number(expiry) * 1000).toBeLessThan(Date.now() + 70_000);
  await routes.cleanup();
  expect(resources.size).toBe(10);
  const foreign = "pstdio-preview-cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  certificates.set(foreign, {
    name: foreign,
    labels: {
      "managed-by": "pstdio-isolated-preview",
      "preview-deployment": "another-deployment",
      "preview-expires": "1",
    },
  });
  running.delete(ids[0]);
  await routes.cleanup();
  expect(resources.size).toBe(5);
  expect(certificates.size).toBe(2);
  expect(entries.size).toBe(1);
  expect([...resources.values()].every((r) => r.metadata.labels["pocketcoder.workspace"] === ids[1])).toBe(true);
  certificates.get("pstdio-preview-" + ids[1]).labels["preview-expires"] = "1";
  await routes.cleanup();
  expect(resources.size).toBe(0);
  expect(certificates.size).toBe(1);
  expect(certificates.has(foreign)).toBe(true);
  expect(entries.size).toBe(0);
});
