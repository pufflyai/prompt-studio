import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

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
