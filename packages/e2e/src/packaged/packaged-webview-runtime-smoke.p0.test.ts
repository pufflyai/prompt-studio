import { expect, test } from "bun:test";
import { inlineRuntimeScript } from "./packaged-webview-runtime-smoke";

test("runtime smoke reads the outer classic script when its body contains a script-tag template", () => {
  const code = `const nested = "<script>keyboardRelay()<\\/script>"; globalThis.runtime = nested;`;
  const html = `<html><script type="text/javascript">${code}</script></html>`;
  expect(inlineRuntimeScript(html)).toBe(code);
  expect(new Bun.Transpiler({ loader: "js" }).scan(inlineRuntimeScript(html)!).imports).toEqual([]);
});
