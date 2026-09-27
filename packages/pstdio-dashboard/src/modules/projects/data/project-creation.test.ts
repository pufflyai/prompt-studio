import { afterEach, expect, test } from "bun:test";
import { createProject } from "./project-creation";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockProjectSetup = (setupError: string | null = null) => {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = Object.assign(
    async (input: unknown, init: RequestInit) => {
      calls.push({ url: String(input), init });
      if (init.method === "POST") return Response.json({ id: "project", name: "研究" }, { status: 201 });
      return Response.json([
        { is_default: true, setup_error: setupError, provider_state: "ready", root_path: "/notes/研究" },
      ]);
    },
    { preconnect: originalFetch.preconnect },
  ) as typeof fetch;
  return calls;
};

test("opens a folder through server-owned initialization and verifies its workspace", async () => {
  const calls = mockProjectSetup();
  expect(await createProject({ path: "/notes/研究" })).toMatchObject({ id: "project" });
  expect(calls.filter(({ init }) => init.method === "POST")).toHaveLength(1);
  expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
    initial_workspace: { provider_id: "pstdio.root", params: { path: "/notes/研究" } },
  });
});

test("keeps a failed folder setup available for retry instead of opening it as ready", async () => {
  mockProjectSetup("Extension setup failed");
  await expect(createProject({ path: "/notes/研究" })).rejects.toThrow("Extension setup failed");
});
