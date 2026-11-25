import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { isProcessAlive } from "pstdio-paths";
import { bundleEntry, bundleLimits } from "./bundle-entry";
import { createPreparationClient } from "./preparation-client";

const spawnMacroChild = (source: string, report: string, mode: "hang" | "finish" | "exit" = "hang") => {
  const entry = join(source, "extension.ts");
  const finish = {
    hang: "while (true);",
    finish: 'child.unref(); return "completed";',
    exit: "process.exit(31);",
  }[mode];
  writeFileSync(
    join(source, "macro.ts"),
    `import { renameSync, writeFileSync } from "node:fs";
export const run = () => {
  const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] });
  process.kill(child.pid, 0);
  const report = ${JSON.stringify(report)};
  writeFileSync(report + ".tmp", JSON.stringify({ bundler: process.pid, descendant: child.pid, cwd: process.cwd() }));
  renameSync(report + ".tmp", report);
  ${finish}
};`,
  );
  writeFileSync(entry, 'import { run } from "./macro.ts" with { type: "macro" };\nexport default { value: run() };');
  return entry;
};

const readMacroProcesses = (report: string) =>
  JSON.parse(readFileSync(report, "utf8")) as { bundler: number; descendant: number; cwd: string };

const waitForMacro = async (report: string) => {
  for (let attempt = 0; !existsSync(report) && attempt < 150; attempt++) await Bun.sleep(20);
  const processes = readMacroProcesses(report);
  expect(isProcessAlive(processes.bundler)).toBe(true);
  expect(isProcessAlive(processes.descendant)).toBe(true);
  return processes;
};

const expectMacroStopped = async ({ bundler, descendant, cwd }: ReturnType<typeof readMacroProcesses>) => {
  for (let attempt = 0; isProcessAlive(descendant) && attempt < 50; attempt++) await Bun.sleep(20);
  expect(isProcessAlive(bundler)).toBe(false);
  expect(isProcessAlive(descendant)).toBe(false);
  expect(existsSync(cwd)).toBe(false);
};

const cleanMacro = (report: string) => {
  if (!existsSync(report)) return;
  const { bundler, descendant, cwd } = readMacroProcesses(report);
  for (const pid of [bundler, descendant]) if (isProcessAlive(pid)) process.kill(pid, "SIGKILL");
  rmSync(cwd, { recursive: true, force: true });
};

test("reports the unresolved dependency when an extension cannot be bundled", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-error-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { default } from "missing-desktop-dependency";');
  try {
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("missing-desktop-dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent bundles of one entry resolve to the same finished bundle", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-shared-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export default { marker: "shared-bundle" };');
  try {
    // Read the bundle the moment each call resolves: a call that resolves before the build
    // finishes sees a missing or partial file.
    const results = await Promise.all(
      Array.from({ length: 4 }, async () => {
        const bundlePath = await bundleEntry(entry, root, join(root, "out"));
        return { bundlePath, contents: readFileSync(bundlePath, "utf8") };
      }),
    );

    const finalContents = readFileSync(results[0].bundlePath, "utf8");
    expect(finalContents).toContain("shared-bundle");
    for (const result of results)
      expect(result).toEqual({ bundlePath: results[0].bundlePath, contents: finalContents });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("retries an unchanged source when its bundle output becomes writable", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-output-repair-"));
  const entry = join(root, "extension.ts");
  const outDir = join(root, "out");
  writeFileSync(entry, "export default () => 42;");
  writeFileSync(outDir, "An existing file blocks the output directory.");
  try {
    let failure: unknown;
    try {
      await bundleEntry(entry, root, outDir);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    rmSync(outDir);

    const bundlePath = await bundleEntry(entry, root, outDir);
    const loaded = await import(bundlePath);
    expect(loaded.default()).toBe(42);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a load during a pending build joins it instead of reading partial output", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-visible-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export default { marker: "finished-bundle" };');
  try {
    const first = bundleEntry(entry, root, join(root, "out"));
    const second = bundleEntry(entry, root, join(root, "out"));
    expect(second).toBe(first);
    expect(readFileSync(await second, "utf8")).toContain("finished-bundle");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("macros run while bundling without the host's environment secrets", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-macro-"));
  const entry = join(root, "extension.ts");
  const report = join(root, "macro-saw.txt");
  writeFileSync(
    join(root, "macro.ts"),
    `import { writeFileSync } from "node:fs";
export const probe = () => { writeFileSync(${JSON.stringify(report)}, String(process.env.PSTDIO_API_TOKEN)); return "probed"; };`,
  );
  writeFileSync(
    entry,
    'import { probe } from "./macro.ts" with { type: "macro" };\nexport default { value: probe() };',
  );
  process.env.PSTDIO_API_TOKEN = "host-runtime-token";
  try {
    await bundleEntry(entry, root, join(root, "out"));
    expect(readFileSync(report, "utf8")).toBe("undefined");
  } finally {
    delete process.env.PSTDIO_API_TOKEN;
    rmSync(root, { recursive: true, force: true });
  }
});

test("a macro that never finishes fails the build at the deadline, and a later build can run", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-hang-"));
  const report = join(root, "macro-processes.json");
  const entry = spawnMacroChild(root, report);
  const previous = bundleLimits.deadlineMs;
  bundleLimits.deadlineMs = 1_000;
  try {
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("did not finish within 1 s");
    await expectMacroStopped(readMacroProcesses(report));
    writeFileSync(
      join(root, "macro.ts"),
      'export const noisy = () => { process.stdout.write("macro noise"); return 1; };',
    );
    writeFileSync(
      entry,
      'import { noisy } from "./macro.ts" with { type: "macro" };\nexport default { value: noisy() };',
    );
    expect(await bundleEntry(entry, root, join(root, "out"))).toContain(".pstdio-runtime-bundle.mjs");
  } finally {
    bundleLimits.deadlineMs = previous;
    cleanMacro(report);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a completed build stops a macro child holding its output pipes open", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-complete-"));
  const report = join(root, "macro-processes.json");
  try {
    const entry = spawnMacroChild(root, report, "finish");
    const built = await bundleEntry(entry, root, join(root, "out"));
    expect(readFileSync(built, "utf8")).toContain("completed");
    const { bundler, descendant, cwd } = readMacroProcesses(report);
    expect(isProcessAlive(bundler)).toBe(false);
    expect(isProcessAlive(descendant)).toBe(false);
    expect(existsSync(cwd)).toBe(false);
  } finally {
    cleanMacro(report);
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform !== "win32")("an exited bundler still owns its macro child", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-exit-"));
  const report = join(root, "macro-processes.json");
  try {
    const entry = spawnMacroChild(root, report, "exit");
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("exited (31) without a result");
    await expectMacroStopped(readMacroProcesses(report));
  } finally {
    cleanMacro(report);
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([
  "cancel",
  "shutdown",
] as const)("a preparation %s stops the bundler and the process its macro started", async (mode) => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-retirement-"));
  const source = join(root, "source");
  const report = join(root, "macro-processes.json");
  const client = createPreparationClient(() => new Worker(new URL("./preparation-worker.ts", import.meta.url)));
  const controller = new AbortController();
  try {
    mkdirSync(source);
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "macro",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    const entry = spawnMacroChild(source, report);
    const prepare = (signal?: AbortSignal) =>
      client.run("runtime.prepare", { sourcePath: source }, { home: join(root, "home"), signal });
    const pending = prepare(controller.signal).catch((error: unknown) => error);
    const processes = await waitForMacro(report);
    if (mode === "cancel") controller.abort(new Error("Cancelled extension preparation."));
    else await client.stop();
    expect(await pending).toMatchObject({
      message: mode === "cancel" ? "Cancelled extension preparation." : "Extension preparation stopped.",
    });
    await expectMacroStopped(processes);

    writeFileSync(entry, "export default {};");
    await expect(prepare()).resolves.toMatchObject({
      entryPath: expect.stringContaining(".pstdio-runtime-bundle.mjs"),
    });
  } finally {
    await client.stop();
    cleanMacro(report);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a macro that floods its output still reports the build's outcome", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-flood-"));
  const entry = join(root, "extension.ts");
  writeFileSync(
    join(root, "macro.ts"),
    'export const flood = () => { const block = "x".repeat(1 << 20); for (let i = 0; i < 32; i++) process.stdout.write(block); return 1; };',
  );
  writeFileSync(
    entry,
    'import { flood } from "./macro.ts" with { type: "macro" };\nexport default { value: flood() };',
  );
  try {
    expect(await bundleEntry(entry, root, join(root, "out"))).toContain(".pstdio-runtime-bundle.mjs");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a macro exiting with code zero without a build result fails preparation", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-exit-"));
  const entry = join(root, "extension.ts");
  writeFileSync(join(root, "macro.ts"), "export const exit = () => process.exit(0);");
  writeFileSync(entry, 'import { exit } from "./macro.ts" with { type: "macro" };\nexport default { value: exit() };');
  try {
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("without a result");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("extension commands can import a public package with incidental CSS", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-css-"));
  const entry = join(root, "extension.ts");
  writeFileSync(join(root, "style.css"), ".example { color: red; }");
  writeFileSync(join(root, "helper.ts"), 'import "./style.css"; export const next = (value: number) => value + 1;');
  writeFileSync(entry, 'import { next } from "./helper"; export default { run: () => next(41) };');
  try {
    const bundlePath = await bundleEntry(entry, root, join(root, "out"));
    const loaded = await import(bundlePath);
    expect(loaded.default.run()).toBe(42);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a prepared copy imports dependencies that find their own file through __filename", async () => {
  const snapshotRoot = mkdtempSync(join(tmpdir(), "extension-bundle-snapshot-"));
  // Prepared revisions nest the package below the snapshot root.
  const packagePath = join(snapshotRoot, "fs", "2f", "staging", "harness");
  const dependency = join(packagePath, "node_modules", "runtime-artifacts");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(dependency, "package.json"), '{"name":"runtime-artifacts","type":"module","main":"index.js"}');
  writeFileSync(
    join(dependency, "index.js"),
    [
      'import { createRequire } from "node:module";',
      'const require2 = createRequire(typeof __filename === "string" ? __filename : import.meta.url);',
      'export const dependencyFile = [typeof require2.resolve, typeof __filename === "string" ? __filename : ""];',
    ].join("\n"),
  );
  const entry = join(packagePath, "extension.ts");
  writeFileSync(
    entry,
    [
      'import { dependencyFile } from "runtime-artifacts";',
      'const ownFile = typeof __filename === "string" ? __filename : import.meta.url;',
      "export default { dependencyFile, ownFile };",
    ].join("\n"),
  );
  try {
    const bundlePath = await bundleEntry(entry, packagePath, join(snapshotRoot, "out"), snapshotRoot);
    const loaded = await import(bundlePath);
    // Each file keeps its own location, so a dependency can find files next to it.
    expect(loaded.default).toEqual({ dependencyFile: ["function", join(dependency, "index.js")], ownFile: entry });
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true });
  }
});

test("a build whose error is longer than the kept output still fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-long-error-"));
  const entry = join(root, "extension.ts");
  const imports = Array.from({ length: 1_500 }, (_, index) => `import "./missing-module-${index}.ts";`).join("\n");
  writeFileSync(entry, `${imports}\nexport default {};`);
  try {
    let failure: unknown;
    try {
      await bundleEntry(entry, root, join(root, "out"));
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).toContain("missing-module");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
