// Temporary native-run instrumentation. Remove after diagnosing startup.
const path = "packages/pstdio-db/src/db/connection.pglite.ts";
let source = await Bun.file(path).text();
source = source.replace(
  "const PGLITE_WASM_SUFFIX",
  `const desktopStartupDiagnostic = (phase: string) => {
    if (process.env.PSTDIO_LOG_PATH) fs.appendFileSync(process.env.PSTDIO_LOG_PATH,
      JSON.stringify({ time: new Date().toISOString(), event: "diagnostic.database", phase }) + "\\n");
  };
const PGLITE_WASM_SUFFIX`,
);
for (const [before, after] of [
  [
    "  const wasmModule = await WebAssembly.compile(wasmBytes);",
    '  desktopStartupDiagnostic("wasm-start");\n  const wasmModule = await WebAssembly.compile(wasmBytes);\n  desktopStartupDiagnostic("wasm-ready");',
  ],
  [
    "    await openedPglite.waitReady;",
    '    desktopStartupDiagnostic("database-start");\n    await openedPglite.waitReady;\n    desktopStartupDiagnostic("database-ready");',
  ],
  [
    "      await migrate(db, { migrationsFolder });",
    '      desktopStartupDiagnostic("migrations-start");\n      await migrate(db, { migrationsFolder });\n      desktopStartupDiagnostic("migrations-ready");',
  ],
]) {
  if (!source.includes(before)) throw new Error(`Missing diagnostic insertion: ${before}`);
  source = source.replace(before, after);
}
await Bun.write(path, source);

const mainPath = "clients/desktop/src/main.ts";
const main = await Bun.file(mainPath).text();
await Bun.write(
  mainPath,
  main.replace("state: next.kind },", 'state: next.kind, phase: next.kind === "starting" ? next.phase : undefined },'),
);

const instrumentDesktopFile = async (path: string, event: string, replacements: [string, string][]) => {
  let source = await Bun.file(path).text();
  source = `import { appendFileSync as appendStartupDiagnostic } from "node:fs";
const startupDiagnostic = (phase: string) => {
  if (process.env.PSTDIO_LOG_PATH) appendStartupDiagnostic(process.env.PSTDIO_LOG_PATH,
    JSON.stringify({ time: new Date().toISOString(), event: ${JSON.stringify(event)}, phase }) + "\\n");
};
${source}`;
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`Missing diagnostic insertion: ${before}`);
    source = source.replace(before, after);
  }
  await Bun.write(path, source);
};

await instrumentDesktopFile("clients/desktop/src/runtime/sidecar-artifact.ts", "diagnostic.sidecar", [
  [
    "  const checksum = await readBinaryChecksum(binaryPath, input.signal);",
    '  startupDiagnostic("checksum-start");\n  const checksum = await readBinaryChecksum(binaryPath, input.signal);\n  startupDiagnostic("checksum-ready");',
  ],
  [
    "  const binaryVersion = await (input.readVersion ?? readBinaryVersion)(binaryPath, input.signal);",
    '  startupDiagnostic("version-start");\n  const binaryVersion = await (input.readVersion ?? readBinaryVersion)(binaryPath, input.signal);\n  startupDiagnostic("version-ready");',
  ],
]);

await instrumentDesktopFile("clients/desktop/src/runtime/runtime-environment.ts", "diagnostic.shell", [
  [
    "    const stdout = await readShellPath(shell, env, signal);",
    '    startupDiagnostic("path-start");\n    const stdout = await readShellPath(shell, env, signal);\n    startupDiagnostic("path-ready");',
  ],
]);
