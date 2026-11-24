import { expect, test } from "bun:test";
import type { Api } from "./connection";
import { PocketCoderError } from "./connection";
import { readRunReceipt } from "./run-deadline";
import type { RunRecord } from "./runs";

test("a receipt read interrupted at the deadline gets a fresh final read", async () => {
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    async fetch() {
      if (++reads === 1) await Bun.sleep(200);
      return Response.json({ finalizedAt: "2026-01-01T00:00:00Z" });
    },
  });
  const api: Api = async ({ signal }) => (await (await fetch(server.url, { signal })).json()) as never;
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    timeoutSeconds: 60,
    startedAt: new Date(Date.now() - 1_860_000 + 100).toISOString(),
    stopAfterRun: true,
  };
  try {
    expect(await readRunReceipt(api, "/receipt", record, undefined, true)).toMatchObject({
      finalizedAt: "2026-01-01T00:00:00Z",
    });
    expect(reads).toBe(2);
  } finally {
    await server.stop(true);
  }
});

test("a saved submission still being admitted can temporarily have no receipt", async () => {
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    timeoutSeconds: 60,
    startedAt: new Date().toISOString(),
    stopAfterRun: true,
    submissionPending: true,
  };
  const api: Api = async () => {
    throw new PocketCoderError(404, "Request not found");
  };
  expect(await readRunReceipt(api, "/receipt", record, undefined, true)).toBeNull();
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  expect(await readRunReceipt(api, "/receipt", record, undefined, true)).toBeNull();
  record.submissionPending = false;
  await expect(readRunReceipt(api, "/receipt", record, undefined, true)).rejects.toThrow("HTTP 404");
});
