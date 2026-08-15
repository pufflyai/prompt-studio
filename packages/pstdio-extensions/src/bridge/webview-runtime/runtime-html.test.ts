import { describe, expect, test } from "bun:test";
import {
  getExtensionRuntimeScriptUrl,
  renderExtensionRuntimeHtml,
  renderInlineExtensionRuntimeHtml,
} from "./runtime-html";

describe("extension runtime html", () => {
  test("can reference the packaged runtime bundle by URL", () => {
    const scriptUrl = getExtensionRuntimeScriptUrl();
    const html = renderExtensionRuntimeHtml(scriptUrl);

    expect(scriptUrl).toContain("runtime.bundle.js");
    expect(html).toContain(scriptUrl.replaceAll("&", "&amp;"));
    expect(html).toContain("<script src=");
    expect(html).not.toContain("use-credentials");
    expect(html).not.toContain('type="module"');
  });

  test("can inline the runtime bundle into the host document", () => {
    const html = renderInlineExtensionRuntimeHtml('window.runtimeLoaded = "</script>";');

    expect(html).toContain("<script>");
    expect(html).toContain("<\\/script>");
    expect(html).not.toContain("<script src=");
  });
});
