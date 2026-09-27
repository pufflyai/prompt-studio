import { beforeEach, expect, test } from "bun:test";
import { resetApiClient } from "@/features/api-client";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { createAndInitProject } from "./create-and-init";

beforeEach(resetApiClient);
test("opens a folder through the server-owned initialization flow", async () => {
  mockFetchSequence([
    { status: 201, body: { id: "project", name: "1234" } },
    { status: 200, body: [{ is_default: true, provider_state: "ready", root_path: "/documents/1234" }] },
  ]);
  expect(await createAndInitProject("/documents/1234")).toEqual({ id: "project", name: "1234" } as never);
  const call = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
  expect(JSON.parse(call[1].body as string)).toEqual({
    initial_workspace: { provider_id: "pstdio.root", params: { path: "/documents/1234" } },
  });
});

test("reports failed setup without reporting the folder ready", async () => {
  mockFetchSequence([
    { status: 201, body: { id: "project", name: "1234" } },
    { status: 200, body: [{ is_default: true, setup_error: "Extension setup failed" }] },
  ]);
  await expect(createAndInitProject("/documents/1234")).rejects.toThrow("Extension setup failed");
});
