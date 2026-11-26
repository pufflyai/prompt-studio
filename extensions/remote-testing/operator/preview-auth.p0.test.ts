import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreviewGate } from "./preview-gate";

const servers: { stop(close?: boolean): unknown }[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) server.stop(true);
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function preview(id: string) {
  const directory = await mkdtemp(join(tmpdir(), "preview-auth-"));
  directories.push(directory);
  await mkdir(directory + "/.pstdio");
  await mkdir(directory + "/invitations");
  await Bun.write(directory + "/.pstdio/runtime.json", JSON.stringify({ token: "runtime-" + id }));
  const app = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/runtime/browser-login") {
        expect(request.headers.get("authorization")).toBe("Bearer runtime-" + id);
        return Response.json({ url: new URL(request.url).origin + "/#browser-login=" + id });
      }
      return new Response("app-" + id);
    },
  });
  servers.push(app);
  const origin = `https://${id}.preview.example.test`;
  const config = { origin, workspaceId: id, expiresAt: Date.now() + 60_000 };
  const gate = createPreviewGate({ home: directory, root: directory, local: app.url.origin, config, port: 0 });
  servers.push(gate);
  const invite = id.repeat(43);
  await Bun.write(directory + "/invitations/" + createHash("sha256").update(invite).digest("hex"), "");
  const request = (path: string, options: RequestInit = {}) =>
    fetch(new URL(path, gate.url), {
      ...options,
      headers: { Host: new URL(origin).host, Origin: origin, ...options.headers },
      redirect: "manual",
    });
  return { request, invite };
}

test("two browser invitations establish isolated host sessions without replacing each other", async () => {
  const [a, b] = await Promise.all([preview("a"), preview("b")]);
  const [loginA, loginB] = await Promise.all(
    [a, b].map((p) => p.request("/__preview/login", { method: "POST", body: p.invite })),
  );
  expect(loginA.status).toBe(200);
  expect(loginB.status).toBe(200);
  expect(await loginA.json()).toEqual({ location: "/#browser-login=a" });
  expect(await loginB.json()).toEqual({ location: "/#browser-login=b" });
  const cookieA = loginA.headers.get("set-cookie")!;
  const cookieB = loginB.headers.get("set-cookie")!;
  expect(cookieA).toContain("Secure; HttpOnly; SameSite=Strict");
  expect(cookieA).not.toContain("Domain=");
  expect(cookieB).not.toBe(cookieA);
  expect(await (await a.request("/", { headers: { Cookie: cookieA } })).text()).toBe("app-a");
  expect(await (await b.request("/", { headers: { Cookie: cookieB } })).text()).toBe("app-b");
  expect((await b.request("/v1/projects", { headers: { Cookie: cookieA } })).status).toBe(401);
  expect((await a.request("/v1/projects", { headers: { Cookie: cookieB } })).status).toBe(401);
  expect((await a.request("/__preview/login", { method: "POST", body: a.invite })).status).toBe(401);
  expect(
    (
      await b.request("/__preview/login", {
        method: "POST",
        body: b.invite,
        headers: { Origin: "https://a.preview.example.test" },
      })
    ).status,
  ).toBe(403);
  expect(await (await a.request("/", { headers: { Cookie: cookieA } })).text()).toBe("app-a");
});
