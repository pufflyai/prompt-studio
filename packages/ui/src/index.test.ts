import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
