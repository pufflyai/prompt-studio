import { describe, expect, test } from "bun:test";
import { getExtensionRuntimeScript, renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime";
import { EXTENSION_RUNTIME_SCRIPT_URL } from "./extension-runtime-routes";

const expectNoExternalExecutableSource = (content: string) => {
  expect(content).not.toContain("https://");
  expect(content).not.toContain("http://");
  expect(content).not.toContain("esm.sh");
};

describe("extension runtime routes", () => {
  test("serve runtime html and script without external executable sources", () => {
    const html = renderExtensionRuntimeHtml(EXTENSION_RUNTIME_SCRIPT_URL);
    const script = getExtensionRuntimeScript();

    expect(html).toContain(`src="${EXTENSION_RUNTIME_SCRIPT_URL}"`);
    expectNoExternalExecutableSource(html);
    expectNoExternalExecutableSource(script);
  });
});
