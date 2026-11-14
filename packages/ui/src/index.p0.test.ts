import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("a basic UI consumer does not import unused lazy components", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-ui-consumer-"));
  const entry = join(root, "consumer.ts");
  const uiEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  writeFileSync(entry, `export { AlertMessage } from ${JSON.stringify(uiEntry)};`);

  try {
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: join(root, "out"),
      target: "browser",
      packages: "external",
      splitting: true,
    });
    expect(result.success).toBe(true);
    const bundledEntry = result.outputs.find((output) => output.kind === "entry-point");
    if (!bundledEntry) throw new Error("Consumer entry was not built.");
    const imports = new Bun.Transpiler({ loader: "js" }).scanImports(await bundledEntry.text());
    expect(imports.filter((item) => item.kind === "dynamic-import")).toHaveLength(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the UI entry point supports server rendering", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `const { ChakraProvider, psTheme } = await import("./dist/index.js");
      const { createElement } = await import("react");
      const { renderToString } = await import("react-dom/server");
      console.log(renderToString(createElement(ChakraProvider, { value: psTheme }, "Ready")));`,
    ],
    { cwd: fileURLToPath(new URL("..", import.meta.url)) },
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Ready");
});

test("the built UI entry exposes visibility for optional tree-row observations", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `const { useTreeListRowVisibility } = await import("./dist/index.js");
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const Row = () => createElement("output", null, String(useTreeListRowVisibility()));
      console.log(renderToStaticMarkup(createElement(Row)));`,
    ],
    { cwd: fileURLToPath(new URL("..", import.meta.url)) },
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString().trim()).toBe("<output>true</output>");
});

test.each([
  { entry: "chat-skeleton", exported: "ChatSkeleton" },
  { entry: "lazy-markdown-editor", exported: "LazyMarkdownEditor" },
  { entry: "lazy-markdown-editor", exported: "preloadMarkdownEditor" },
])("$exported keeps editor dependencies out of its eager browser graph", async ({ entry, exported }) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-ui-startup-"));
  const consumer = join(root, "consumer.ts");
  writeFileSync(
    consumer,
    `export { ${exported} } from ${JSON.stringify(fileURLToPath(new URL(`../dist/${entry}.js`, import.meta.url)))};`,
  );
  try {
    const result = await Bun.build({
      entrypoints: [consumer],
      outdir: join(root, "out"),
      target: "browser",
      packages: "external",
      splitting: true,
    });
    expect(result.success).toBe(true);
    const first = result.outputs.find((output) => output.kind === "entry-point");
    if (!first) throw new Error("Consumer entry was not built.");
    const outputs = new Map(result.outputs.map((output) => [output.path, output]));
    const pending = [first];
    const visited = new Set<string>();
    const eagerEditors = new Set<string>();
    const scanner = new Bun.Transpiler({ loader: "js" });
    while (pending.length) {
      const output = pending.pop()!;
      if (visited.has(output.path)) continue;
      visited.add(output.path);
      for (const dependency of scanner.scanImports(await output.text())) {
        if (dependency.kind === "dynamic-import") continue;
        if (/^(?:@lexical\/|lexical$|katex$)/.test(dependency.path)) eagerEditors.add(dependency.path);
        const next = outputs.get(resolve(dirname(output.path), dependency.path));
        if (next) pending.push(next);
      }
    }
    expect([...eagerEditors]).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
