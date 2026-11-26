import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createWorkflowHandler } from "./routes";

const token = "single-workflow-key";
const runId = "4feb9929-01f1-4e3e-ac7e-18ee36c7d501";
const calls: string[][] = [];
const handler = createWorkflowHandler({
  keyHash: createHash("sha256").update(token).digest("hex"),
  verifyKey: async (key) => key === token,
  sign: async (method, object, seconds) => {
    calls.push([method, object, String(seconds)]);
    return "https://storage.googleapis.com/signed";
  },
  openPreview: async () => ({ url: "https://preview.example.test/", expiresAt: "2026-11-30T00:00:00.000Z" }),
});

function urlRequest(action: string, options: { key?: string; id?: string; seconds?: number } = {}) {
  return handler(
    new Request("https://controller.example.test/v1/kito-workflow/storage/urls", {
      method: "POST",
      headers: { Authorization: "Bearer " + (options.key ?? token) },
      body: JSON.stringify({ action, runId: options.id ?? runId, seconds: options.seconds ?? 120 }),
    }),
  );
}

test("one workflow key signs only the four bounded run object operations", async () => {
  for (const action of ["upload-source", "read-source", "upload-log", "read-log"]) {
    expect((await urlRequest(action)).status).toBe(200);
  }
  expect(calls).toEqual([
    ["PUT", "sources/" + runId + ".tar.gz", "120"],
    ["GET", "sources/" + runId + ".tar.gz", "120"],
    ["PUT", "logs/" + runId + ".log", "120"],
    ["GET", "logs/" + runId + ".log", "120"],
  ]);
  expect((await urlRequest("read-log", { key: "unrelated-key" })).status).toBe(401);
  expect((await urlRequest("read-log", { id: "../archive" })).status).toBe(400);
  expect((await urlRequest("delete-source")).status).toBe(400);
  expect((await urlRequest("read-source", { seconds: 100_000 })).status).toBe(400);
});
