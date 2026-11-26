import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  acceptPreparedRevision,
  createInvocationScope,
  prepareExtensionRevision,
  stopExtensionPreparation,
} from "pstdio-extensions";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { hostCheckoutPath, packagedExtensionCatalog } from "../extension-catalog";
import { createDiagnosticsApi, isFirstPartySource } from "./diagnostics";

const logger = { info: () => {}, warn: () => {}, error: () => {} };
const performanceEntry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === "performance")!;
const checkout = { sourcePath: hostCheckoutPath(performanceEntry) };
const monitor = () => createDiagnosticsApi({ extensionId: "pstdio.performance", source: checkout });

test("an extension outside the first-party catalog may not profile the host", async () => {
  for (const extensionId of ["example.tool", "pstdio.not-in-catalog"]) {
    await expectRejection(
      createDiagnosticsApi({ extensionId, source: checkout }).capture({ kind: "cpu", durationMs: 10 }),
    ).toMatchObject({ code: "diagnostics_forbidden" });
  }
});

test("a registered catalog id with no verified install may not profile the host", async () => {
  const folder = { sourcePath: import.meta.dirname };
  await expectRejection(
    createDiagnosticsApi({ extensionId: "pstdio.performance", source: folder }).capture({
      kind: "cpu",
      durationMs: 10,
    }),
  ).toMatchObject({ code: "diagnostics_forbidden" });
  expect(await isFirstPartySource("pstdio.performance", folder)).toBe(false);
});

test("the catalog extension from this host's checkout is first-party", async () => {
  expect(await isFirstPartySource("pstdio.performance", checkout)).toBe(true);
});

test("a first-party extension profiles the host process", async () => {
  const result = await monitor().capture({ kind: "cpu", durationMs: 20 });
  expect(result.data.pid).toBe(process.pid);
  expect(result.data.profile?.nodes.length).toBeGreaterThan(0);
});

test("cancelling the invocation stops its capture and frees the profiler", async () => {
  const host = new AbortController();
  const scope = createInvocationScope({ logger, parent: host.signal });
  const capture = createDiagnosticsApi({ extensionId: "pstdio.performance", source: checkout }, scope).capture({
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
  const capture = createDiagnosticsApi({ extensionId: "pstdio.performance", source: checkout }, scope).capture({
    kind: "coverage",
    durationMs: 60_000,
  });
  await Bun.sleep(20);
  await scope.close();
  await expectRejection(capture).toThrow("The invocation that started the capture ended.");
});

test("malformed capture requests return a diagnostic error before registering cleanup", async () => {
  const scope = createInvocationScope({ logger });
  let registrations = 0;
  const diagnostics = createDiagnosticsApi(
    { extensionId: "pstdio.performance", source: checkout },
    {
      ...scope,
      register(cleanup) {
        registrations++;
        scope.register(cleanup);
      },
    },
  );
  for (const request of [null, { kind: "cpu", durationMs: 20, signal: {} }, { kind: "cpu", durationMs: 0 }]) {
    await expectRejection(diagnostics.capture(request as never)).toMatchObject({ code: "diagnostics_invalid_input" });
  }
  expect(registrations).toBe(0);
});

test("closing an invocation releases profiler admission before the next capture", async () => {
  const scope = createInvocationScope({ logger });
  const capture = createDiagnosticsApi({ extensionId: "pstdio.performance", source: checkout }, scope).capture({
    kind: "cpu",
    durationMs: 60_000,
  });
  const ended = expectRejection(capture).toThrow("The invocation that started the capture ended.");
  await Bun.sleep(20);
  await scope.close();
  expect((await monitor().capture({ kind: "cpu", durationMs: 10 })).data.profile?.nodes.length).toBeGreaterThan(0);
  await ended;
});

test("a scope owns one cleanup for repeated valid captures", async () => {
  const scope = createInvocationScope({ logger });
  let registrations = 0;
  const diagnostics = createDiagnosticsApi(
    { extensionId: "pstdio.performance", source: checkout },
    {
      ...scope,
      register(cleanup) {
        registrations++;
        scope.register(cleanup);
      },
    },
  );
  try {
    for (let i = 0; i < 3; i++) await diagnostics.capture({ kind: "cpu", durationMs: 10 });
    expect(registrations).toBe(1);
  } finally {
    await scope.close();
  }
});

test("a verified registry install trusts the same registry with a trailing slash", async () => {
  const root = await mkdtemp(join(tmpdir(), "diagnostics-registry-origin-"));
  const previousHome = process.env.PSTDIO_HOME;
  const sourcePath = join(root, "performance");
  process.env.PSTDIO_HOME = join(root, "home");
  try {
    await mkdir(sourcePath);
    await writeFile(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "performance",
        publisher: "pstdio",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(join(sourcePath, "extension.ts"), "export default {};");
    const registry = "https://registry.example.test";
    const revision = await prepareExtensionRevision(sourcePath);
    const source = { sourcePath, revisionId: revision.id };
    expect(await isFirstPartySource("pstdio.performance", source, registry)).toBe(false);
    await acceptPreparedRevision(sourcePath, {
      ...revision,
      verifiedInstall: {
        sourcePath,
        ref: `psx:${JSON.stringify({ registry, id: "pstdio.performance", version: "1.0.0" })}`,
      },
    });
    expect(await isFirstPartySource("pstdio.performance", source, `${registry}/`)).toBe(true);
    expect(await isFirstPartySource("pstdio.performance", source, "https://other.example.test")).toBe(false);
    expect(await isFirstPartySource("pstdio.performance", source)).toBe(false);
    await writeFile(join(sourcePath, "extension.ts"), "export default { commands: [] };");
    const replacement = await prepareExtensionRevision(sourcePath);
    await acceptPreparedRevision(sourcePath, replacement);
    expect(await isFirstPartySource("pstdio.performance", source, registry)).toBe(false);
    expect(await isFirstPartySource("pstdio.performance", { sourcePath, revisionId: replacement.id }, registry)).toBe(
      false,
    );
  } finally {
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
