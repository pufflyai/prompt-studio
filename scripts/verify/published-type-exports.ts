import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const PACKAGES = ["sdk", "ui", "pstdio-workbench"];

const exportNames = (program: ts.Program, file: string) => {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`Cannot read the exports of ${file}.`);
  return checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => symbol.name)
    .sort();
};

// Compares what each source entry exports with what its published .d.ts exports, so a type
// bundler can neither drop a public member nor leak an internal one.
export const compareEntryExports = (tsconfigPath: string, entries: { source: string; published: string }[]) => {
  const config = ts.getParsedCommandLineOfConfigFile(
    tsconfigPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  if (!config) throw new Error(`Cannot read ${tsconfigPath}.`);
  const sources = ts.createProgram(
    entries.map((entry) => entry.source),
    { ...config.options, noEmit: true },
  );
  const published = ts.createProgram(
    entries.map((entry) => entry.published),
    {
      noEmit: true,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  );
  return entries.map((entry) => {
    const expected = exportNames(sources, entry.source);
    const actual = exportNames(published, entry.published);
    return {
      ...entry,
      missing: expected.filter((name) => !actual.includes(name)),
      extra: actual.filter((name) => !expected.includes(name)),
    };
  });
};

export const verifyPublishedTypeExports = async (repoRoot: string) => {
  for (const name of PACKAGES) {
    const packageRoot = resolve(repoRoot, "packages", name);
    const configPath = join(packageRoot, "rolldown.types.config.ts");
    const { default: config } = await import(configPath);
    const entries = Object.entries(config.input as Record<string, string>).map(([entry, source]) => ({
      source: resolve(packageRoot, source),
      published: resolve(packageRoot, config.output.dir, `${entry}.d.ts`),
    }));
    const differences = compareEntryExports(resolve(dirname(configPath), config.tsconfig), entries).filter(
      (entry) => entry.missing.length > 0 || entry.extra.length > 0,
    );
    for (const entry of differences) {
      console.error(`${entry.published}: missing [${entry.missing}] extra [${entry.extra}]`);
    }
    if (differences.length > 0) throw new Error(`Published types of packages/${name} differ from its source exports.`);
    console.log(`Checked published type exports of ${entries.length} packages/${name} entries.`);
  }
};
