import { expect, test } from "bun:test";
import { createInvocationScope } from "pstdio-extensions";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createDiagnosticsApi } from "./diagnostics";

const logger = { info: () => {}, warn: () => {}, error: () => {} };

test("an extension outside the first-party catalog may not profile the host", async () => {
  await expectRejection(createDiagnosticsApi("example.tool").capture({ kind: "cpu", durationMs: 10 })).toMatchObject({
    code: "diagnostics_forbidden",
  });
  // A publisher prefix alone does not make an extension first-party.
  await expectRejection(
    createDiagnosticsApi("pstdio.not-in-catalog").capture({ kind: "cpu", durationMs: 10 }),
  ).toMatchObject({ code: "diagnostics_forbidden" });
});

test("a first-party extension profiles the host process", async () => {
  const result = await createDiagnosticsApi("pstdio.performance").capture({ kind: "cpu", durationMs: 20 });
  expect(result.data.pid).toBe(process.pid);
  expect(result.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("cancelling the invocation stops its capture and frees the profiler", async () => {
  const host = new AbortController();
  const scope = createInvocationScope({ logger, parent: host.signal });
  const capture = createDiagnosticsApi("pstdio.performance", scope).capture({ kind: "cpu", durationMs: 60_000 });
  await Bun.sleep(20);
  const started = performance.now();
  host.abort();
  await expectRejection(capture).toBeDefined();
  expect(performance.now() - started).toBeLessThan(1000);
  const next = await createDiagnosticsApi("pstdio.performance").capture({ kind: "cpu", durationMs: 10 });
  expect(next.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("a capture ends with the invocation that started it", async () => {
  const scope = createInvocationScope({ logger });
  const capture = createDiagnosticsApi("pstdio.performance", scope).capture({ kind: "coverage", durationMs: 60_000 });
  await Bun.sleep(20);
  await scope.close();
  await expectRejection(capture).toThrow("The invocation that started the capture ended.");
});
