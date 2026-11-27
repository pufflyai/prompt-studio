import { afterEach, expect, test } from "bun:test";
import { createPreviewOpener } from "./preview-route";

const servers: Bun.Server<undefined>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];

test("concurrent previews keep their own origin, invitation and original deadline", async () => {
  const deadline = Date.now() + 60_000;
  const calls: { id: string; origin: string; expiresAt: number }[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      expect(request.headers.get("authorization")).toBe("Bearer operator-key");
      const path = new URL(request.url).pathname;
      const id = path.split("/")[3];
      if (path.endsWith("/prepare")) {
        const config = (await request.json()) as { origin: string; expiresAt: number };
        calls.push({ id, ...config });
        return Response.json(config);
      }
      if (path.endsWith("/invite"))
        return Response.json({
          invite: (id === ids[0] ? "a" : "b").repeat(43),
          expiresAt: new Date(deadline).toISOString(),
        });
      return Response.json({
        state: "ready",
        deadline_at: new Date(deadline).toISOString(),
        template: { name: "prompt-studio-preview-branch" },
        metadata: { purpose: "pstdio-preview" },
      });
    },
  });
  servers.push(server);
  const routed: string[] = [];
  const open = createPreviewOpener(server.url.origin, {
    origin: (id: string) => `https://${id}.preview.example.test`,
    ensure: async (id: string) => {
      routed.push(id);
    },
    healthy: async () => true,
  });
  const [a, b] = await Promise.all(ids.map((id) => open(id, "operator-key")));
  expect(new URL(a.url).origin).not.toBe(new URL(b.url).origin);
  expect(a.workspaceId).toBe(ids[0]);
  expect(b.workspaceId).toBe(ids[1]);
  expect(calls.map((c) => c.origin).sort()).toEqual(ids.map((id) => `https://${id}.preview.example.test`).sort());
  expect(calls.every((c) => c.expiresAt === deadline)).toBe(true);
  expect(routed.sort()).toEqual(ids);
  expect(a.url).toContain("#invite=" + "a".repeat(43));
  expect(b.url).toContain("#invite=" + "b".repeat(43));
});
