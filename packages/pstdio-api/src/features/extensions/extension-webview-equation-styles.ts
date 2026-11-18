import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { readWebviewBuildMetadata } from "./extension-webview-entry-styles";

const normalizePath = (path: string) => path.replaceAll("\\", "/");

const loadEquationStyles = (stylesheet: string) => `
await new Promise((resolve, reject) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(${JSON.stringify(stylesheet)}, import.meta.url).href;
  link.onload = resolve;
  link.onerror = () => reject(new Error("Could not load equation styles"));
  document.head.append(link);
});
`;

export const deferWebviewEquationStyles = (distDir: string, metafilePath: string) => {
  const { inputs, outputs } = readWebviewBuildMetadata(metafilePath);
  const entries = Object.entries(outputs);
  const equation = entries.find(([, output]) =>
    /(?:^|\/)@pstdio\/ui\/dist\/EquationComponent-[^/]+\.js$/.test(normalizePath(output.entryPoint ?? "")),
  );
  if (!equation) return;
  const [script, { cssBundle, entryPoint }] = equation;
  if (!entryPoint || !cssBundle || !outputs[cssBundle]) return;
  const imports = entries.flatMap(([, output]) => output.imports.filter(({ path }) => path === script));
  if (!imports.length || imports.some(({ kind }) => kind !== "dynamic-import")) return;

  const stylesheetInputs = Object.keys(outputs[cssBundle].inputs);
  const [source] = stylesheetInputs;
  if (stylesheetInputs.length !== 1 || !source || !normalizePath(source).endsWith("/katex/dist/katex.css")) return;
  const sourcePath = normalizePath(source);
  const importers = Object.entries(inputs).filter(([, input]) =>
    input.imports.some(({ path }) => normalizePath(path) === sourcePath),
  );
  if (importers.length !== 1 || normalizePath(importers[0]![0]) !== normalizePath(entryPoint)) return;

  // Bun copies CSS from dynamic chunks into their importers' stylesheets. KaTeX's
  // rules are scoped to equations, so keep them in the shared UI equation chunk.
  // Retain the eager rules if Bun merges them in a way we cannot match exactly.
  const css = readFileSync(join(distDir, cssBundle), "utf8").trimEnd();
  const containingStyles = entries.filter(
    ([file, output]) => file !== cssBundle && file.endsWith(".css") && Object.hasOwn(output.inputs, source),
  );
  const styles = containingStyles.map(([file]) => {
    const path = join(distDir, file);
    return { path, content: readFileSync(path, "utf8") };
  });
  if (!css || !styles.length || styles.some(({ content }) => !content.includes(css))) return;

  for (const { path, content } of styles) writeFileSync(path, content.replaceAll(css, ""));
  const scriptPath = join(distDir, script);
  const stylesheet = normalizePath(relative(dirname(scriptPath), join(distDir, cssBundle)));
  writeFileSync(scriptPath, loadEquationStyles(`./${stylesheet}`) + readFileSync(scriptPath, "utf8"));
};
