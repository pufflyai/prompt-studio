import { expect, test } from "bun:test";
import { createInvocationScope } from "pstdio-extensions";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { hostCheckoutPath, packagedExtensionCatalog } from "../extension-catalog";
import { createDiagnosticsApi, type DiagnosticsSource, isFirstPartySource } from "./diagnostics";

const logger = { info: () => {}, warn: () => {}, error: () => {} };
const performanceEntry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === "performance")!;
const commit = "a".repeat(40);
const gitSource = (url: string, path: string): DiagnosticsSource => ({
  source_kind: "git",
  source_path: "/installed/performance",
  source_ref: `${url}@${commit}#${path}`,
});
const catalogSource = gitSource(performanceEntry.origin.url, performanceEntry.origin.path);
const releaseRegistry = "https://registry.example.test";
const registrySource = (registry: string, id: string): DiagnosticsSource => ({
  source_kind: "registry",
  source_path: "/installed/performance",
  source_ref: `psx:${JSON.stringify({ registry, id, version: "1.0.0" })}`,
});
const monitor = (source = catalogSource) =>
  createDiagnosticsApi({ extensionId: "pstdio.performance", source, releaseRegistry });

test("an extension outside the first-party catalog may not profile the host", async () => {
  await expectRejection(
    createDiagnosticsApi({ extensionId: "example.tool", source: catalogSource }).capture({
      kind: "cpu",
      durationMs: 10,
    }),
  ).toMatchObject({ code: "diagnostics_forbidden" });
  // A publisher prefix alone does not make an extension first-party.
  await expectRejection(
    createDiagnosticsApi({ extensionId: "pstdio.not-in-catalog", source: catalogSource }).capture({
      kind: "cpu",
      durationMs: 10,
    }),
  ).toMatchObject({ code: "diagnostics_forbidden" });
});

test("a catalog id installed from another source may not profile the host", async () => {
  const folder = { source_kind: "local_path", source_path: import.meta.dirname, source_ref: null };
  await expectRejection(monitor(folder).capture({ kind: "cpu", durationMs: 10 })).toMatchObject({
    code: "diagnostics_forbidden",
  });
  expect(isFirstPartySource("pstdio.performance", folder, releaseRegistry)).toBe(false);
  expect(
    isFirstPartySource(
      "pstdio.performance",
      gitSource("https://github.com/someone/prompt-studio", performanceEntry.origin.path),
    ),
  ).toBe(false);
  expect(
    isFirstPartySource("pstdio.performance", gitSource(performanceEntry.origin.url, "extensions/pstdio-notes")),
  ).toBe(false);
  expect(isFirstPartySource("pstdio.performance", { ...catalogSource, source_ref: null })).toBe(false);
  expect(
    isFirstPartySource(
      "pstdio.performance",
      registrySource("https://other.example.test", "pstdio.performance"),
      releaseRegistry,
    ),
  ).toBe(false);
  expect(isFirstPartySource("pstdio.performance", registrySource(releaseRegistry, "pstdio.performance"))).toBe(false);
});

test("a catalog id from its Git origin, the release registry or this host's checkout is first-party", () => {
  expect(isFirstPartySource("pstdio.performance", catalogSource)).toBe(true);
  expect(
    isFirstPartySource("pstdio.performance", registrySource(releaseRegistry, "pstdio.performance"), releaseRegistry),
  ).toBe(true);
  const checkout = { source_kind: "local_path", source_path: hostCheckoutPath(performanceEntry), source_ref: null };
  expect(isFirstPartySource("pstdio.performance", checkout)).toBe(true);
});

test("a first-party extension profiles the host process", async () => {
  const result = await monitor().capture({ kind: "cpu", durationMs: 20 });
  expect(result.data.pid).toBe(process.pid);
  expect(result.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("cancelling the invocation stops its capture and frees the profiler", async () => {
  const host = new AbortController();
  const scope = createInvocationScope({ logger, parent: host.signal });
  const capture = createDiagnosticsApi({ extensionId: "pstdio.performance", source: catalogSource }, scope).capture({
    kind: "cpu",
    durationMs: 60_000,
  });
  await Bun.sleep(20);
  const started = performance.now();
  host.abort();
  await expectRejection(capture).toBeDefined();
  expect(performance.now() - started).toBeLessThan(1000);
  const next = await monitor().capture({ kind: "cpu", durationMs: 10 });
  expect(next.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("a capture ends with the invocation that started it", async () => {
  const scope = createInvocationScope({ logger });
  const capture = createDiagnosticsApi({ extensionId: "pstdio.performance", source: catalogSource }, scope).capture({
    kind: "coverage",
    durationMs: 60_000,
  });
  await Bun.sleep(20);
  await scope.close();
  await expectRejection(capture).toThrow("The invocation that started the capture ended.");
});
