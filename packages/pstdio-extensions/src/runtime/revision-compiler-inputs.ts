import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { revisionSnapshotPath } from "./revision-snapshot-path";

interface CompilerConfig {
  extends?: string | string[];
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]>; [key: string]: unknown };
  [key: string]: unknown;
}
export interface RevisionCompilerInput {
  contents: Buffer;
  references: Array<string | undefined>;
  opaque: boolean;
  jsxImports: string[];
}
const compilerReference = (reference: string, from: string) => {
  if (reference.startsWith(".") || isAbsolute(reference)) {
    const path = resolve(from, reference);
    const found = [path, `${path}.json`, join(path, "tsconfig.json")].find(existsSync);
    return found ? realpathSync(found) : undefined;
  }
  for (const specifier of [reference, `${reference}/tsconfig.json`]) {
    try {
      return realpathSync(Bun.resolveSync(specifier, from));
    } catch {}
  }
};
const references = (config: { extends?: string | string[] }) =>
  typeof config.extends === "string" ? [config.extends] : (config.extends ?? []);
const collectCompilerInput = (
  path: string,
  inputs: Map<string, RevisionCompilerInput>,
  readSource: (path: string) => Buffer,
) => {
  path = realpathSync(path);
  const existing = inputs.get(path);
  if (existing) return existing;
  const input: RevisionCompilerInput = { contents: readSource(path), references: [], opaque: false, jsxImports: [] };
  inputs.set(path, input);
  try {
    const config = Bun.JSON5.parse(input.contents.toString()) as CompilerConfig;
    const options = config.compilerOptions;
    input.opaque = Boolean(config.extends || options?.paths || options?.baseUrl || options?.jsxImportSource);
    if (typeof options?.jsxImportSource === "string") input.jsxImports.push(options.jsxImportSource);
    input.references = references(config).map((reference) => compilerReference(reference, dirname(path)));
    for (const parent of input.references)
      if (parent) {
        const inherited = collectCompilerInput(parent, inputs, readSource);
        input.opaque ||= inherited.opaque;
        input.jsxImports.push(...inherited.jsxImports);
      }
  } catch {
    // The actual Bun build reports invalid compiler configuration.
  }
  return input;
};
export const inspectCompilerConfiguration = (
  canonical: string,
  file: string,
  files: Set<string>,
  directories: Set<string>,
  inputs: Map<string, RevisionCompilerInput>,
  includeOpaqueDependencies: () => void,
  readSource: (path: string) => Buffer,
  addImplicitImport: (specifier: string) => void,
) => {
  let current = dirname(file);
  while (!directories.has(current)) {
    directories.add(current);
    for (const name of ["tsconfig.json", "jsconfig.json"]) {
      const config = join(current, name);
      if (!existsSync(config)) continue;
      files.add(relative(canonical, config));
      const input = collectCompilerInput(config, inputs, readSource);
      if (input.opaque) includeOpaqueDependencies();
      for (const runtime of new Set(input.jsxImports)) {
        addImplicitImport(`${runtime}/jsx-runtime`);
        addImplicitImport(`${runtime}/jsx-dev-runtime`);
      }
    }
    if (current === canonical) return;
    current = dirname(current);
  }
};
const frozenCompilerContents = (input: RevisionCompilerInput, generationRoot: string) => {
  let contents = input.contents.toString();
  try {
    const config = Bun.JSON5.parse(contents) as CompilerConfig;
    if (config.extends) {
      const parents = references(config).map((reference, index) =>
        input.references[index] ? revisionSnapshotPath(generationRoot, input.references[index]!) : reference,
      );
      config.extends = Array.isArray(config.extends) ? parents : parents[0];
    }
    const options = config.compilerOptions;
    if (options) {
      if (typeof options.baseUrl === "string" && isAbsolute(options.baseUrl))
        options.baseUrl = revisionSnapshotPath(generationRoot, options.baseUrl);
      for (const targets of Object.values(options.paths ?? {}) as string[][])
        for (let index = 0; index < targets.length; index++)
          if (isAbsolute(targets[index]!)) targets[index] = revisionSnapshotPath(generationRoot, targets[index]!);
    }
    contents = JSON.stringify(config);
  } catch {}
  return contents;
};
export const copyRevisionCompilerInputs = (inputs: Map<string, RevisionCompilerInput>, generationRoot: string) => {
  for (const [path, input] of inputs) {
    const target = revisionSnapshotPath(generationRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, frozenCompilerContents(input, generationRoot));
  }
};
