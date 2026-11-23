import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSocketIssuer } from "./issuer";

test.skipIf(process.platform === "win32")(
  "central service renews bounded issuer authority through a private controller socket",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "access-issuer-"));
    const socket = join(root, "admin.sock");
    let now = Date.now();
    const calls: Record<string, unknown>[] = [];
    const server = Bun.serve({
      unix: socket,
      async fetch(req) {
        expect(new URL(req.url).pathname).toBe("/v1/owner");
        const body = await req.json();
        calls.push(body);
        return Response.json(
          { token: `issuer-${calls.length}`, key: { expires_at: body.expires_at } },
          { status: 201 },
        );
      },
    });
    try {
      const token = createSocketIssuer(socket, { now: () => now, minimumValidityMs: 900_000 });
      expect(await Promise.all([token(), token()])).toEqual(["issuer-1", "issuer-1"]);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ automation: true, replace: false });
      expect(Date.parse(String(calls[0]!.expires_at)) - now).toBeLessThanOrEqual(7200_000);
      now += 6500_000;
      expect(await token()).toBe("issuer-2");
      expect(calls[1]!.request_id).not.toBe(calls[0]!.request_id);
    } finally {
      server.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  },
);
