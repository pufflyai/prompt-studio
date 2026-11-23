import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionSchema } from "./config";
import { applySession } from "./host-setup";
import { supervise } from "./supervisor";

const cleanup: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

function session() {
  return sessionSchema.parse({
    controllerUrl: "https://controller.example.test",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    renewAt: new Date(Date.now() + 30_000).toISOString(),
    preview: false,
    settings: {
      templateName: "remote-tests",
      templateVersion: "1.0.0",
      testCommand: "bun test",
      timeoutMinutes: 60,
      storageBucket: "bucket",
      signerAccount: "signer@example.test",
    },
    manifests: {
      tests: { metadata: { name: "remote-tests" }, spec: { version: "1.0.0" } },
      preview: { metadata: { name: "prompt-studio-preview" }, spec: { version: "1.0.0" } },
    },
    credentials: [
      { extensionId: "pocketcoder.remote-testing", connectionId: "pocketcoder", secret: "short-lived-private-token" },
    ],
  });
}

test("host setup installs shared settings/manifests and puts credentials only in named connections", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-connect-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const requests: { path: string; method: string; body: unknown }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      expect(req.headers.get("authorization")).toBe("Bearer host-runtime-token");
      const path = new URL(req.url).pathname;
      requests.push({ path, method: req.method, body: req.body ? await req.json() : undefined });
      if (req.method === "GET")
        return Response.json({
          extensions: [
            {
              extensionId: "pocketcoder.remote-testing",
              id: "remote-instance",
              installName: "remote-testing",
              enabled: true,
            },
            {
              extensionId: "pocketcoder.pocketcoder",
              id: "cloud-instance",
              installName: "cloud-workspaces",
              enabled: true,
            },
          ],
        });
      return Response.json({});
    },
  });
  cleanup.push(() => server.stop(true));
  await applySession({
    root,
    projectId: "local-project",
    runtime: { origin: server.url.origin, token: "host-runtime-token" },
    session: session(),
    previewHelper: "",
  });
  expect(
    requests.some((r) => r.path.endsWith("/settings/storageBucket") && JSON.stringify(r.body) === '{"value":"bucket"}'),
  ).toBe(true);
  const credential = requests.find((r) => r.method === "PUT" && r.path.includes("/extension-connections/"));
  expect(credential?.method).toBe("PUT");
  expect(credential?.body).toEqual({ baseUrl: "https://controller.example.test", secret: "short-lived-private-token" });
  const content = await readFile(
    join(root, ".pstdio/extension-storage/pocketcoder.remote-testing/branch-templates/tests.json"),
    "utf8",
  );
  expect(JSON.parse(content).metadata.name).toBe("remote-tests");
  expect(content).not.toContain("private-token");
  expect(
    requests
      .filter((r) => !r.path.includes("extension-connections"))
      .every((r) => !JSON.stringify(r.body ?? {}).includes("short-lived-private-token")),
  ).toBe(true);
});

test("supervisor renews automatically and removes connections after credentials expire", async () => {
  let now = Date.now();
  let calls = 0;
  const applied: string[] = [];
  const warnings: string[] = [];
  const stop = new AbortController();
  const initial = session();
  await supervise({
    now: () => now,
    signal: stop.signal,
    session: async () => {
      calls++;
      if (calls > 2) throw new Error("untrusted error with private-token");
      return {
        ...initial,
        expiresAt: new Date(now + 60_000).toISOString(),
        renewAt: new Date(now + 30_000).toISOString(),
      };
    },
    apply: async (s) => {
      applied.push(s.expiresAt);
    },
    clear: async () => {
      applied.push("cleared");
      stop.abort();
    },
    wait: async () => {
      now += 30_000;
    },
    warn: (s) => warnings.push(s),
  });
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(applied.slice(0, 2)).toHaveLength(2);
  expect(applied.at(-1)).toBe("cleared");
  expect(warnings.join(" ")).not.toContain("private-token");
});
