import { cssModuleInputs } from "./css-module-inputs";
import { readRuntimeModuleImports } from "./runtime-source-snapshot";

export const inspectRevisionModule = (
  file: string,
  contents: Buffer,
  addDependency: (specifier: string, conservative?: boolean, from?: string) => void,
  includeOpaqueDependencies: () => void,
  includeAssets: () => void,
  readSource: (path: string) => Buffer,
  browser: boolean,
) => {
  if (file.endsWith(".css")) {
    for (const specifier of cssModuleInputs(contents.toString())) addDependency(specifier);
    return;
  }
  const source = contents.toString();
  if (/\.[jt]sx$/.test(file)) {
    addDependency("react/jsx-runtime");
    // Custom JSX configuration can introduce a different implicit runtime. Retain the
    // declared closure rather than guessing how an extended config resolves it.
    const customJsx = /@jsxImportSource\s+([^\s*]+)/.exec(source)?.[1];
    if (customJsx) {
      includeOpaqueDependencies();
      addDependency(`${customJsx}/jsx-runtime`);
      addDependency(`${customJsx}/jsx-dev-runtime`);
    }
  }
  if (/import\.meta|\b__dirname\b|\b__filename\b|\breadFile/.test(source)) includeAssets();
  const opaqueImports = /\bcreateRequire\b|import\.meta\.resolve|\brequire\s*\(\s*[^"'\s]|\bimport\s*\(\s*[^"'\s]/.test(
    source,
  );
  // Attributes can execute Bun macros at build time. Retain their Node closure,
  // and never evaluate a macro in the input-inspection transpiler.
  // Check the sparse attribute keywords first; starting the comment matcher at
  // every quote in a bundled dependency causes repeated scans of long comments.
  const clause = /\b(?:with|assert)(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*\{/.test(source);
  const attributes =
    clause &&
    /["'](?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*(?:with|assert)(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*\{/.test(
      source,
    );
  if (opaqueImports) {
    if (browser && !attributes) includeAssets();
    else includeOpaqueDependencies();
  }
  const calls = /\b(?:import|require)(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*\(/.test(source);
  try {
    for (const specifier of readRuntimeModuleImports(file, readSource, calls && !attributes))
      addDependency(specifier, attributes);
  } catch {
    includeOpaqueDependencies();
  }
};
