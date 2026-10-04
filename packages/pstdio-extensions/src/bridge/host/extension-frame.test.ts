import { describe, expect, test } from "bun:test";
import { extensionIframeSandbox } from "./extension-frame";

const host = "http://127.0.0.1:19840";

describe("ExtensionFrame sandbox", () => {
  test("gives a webview on its own origin that origin's storage while keeping navigation sandboxed", () => {
    const flags = extensionIframeSandbox(
      "http://ext-0123456789abcdef01234567.localhost:19840/v1/x/runtime",
      host,
    ).split(" ");

    expect(flags).toContain("allow-same-origin");
    expect(flags).not.toContain("allow-top-navigation");
    expect(flags).not.toContain("allow-popups-to-escape-sandbox");
  });

  test("keeps an opaque origin for runtimes that would share the host page's origin", () => {
    for (const runtimeUrl of [
      `${host}/v1/x/runtime`,
      "blob:http://127.0.0.1:19840/1f2e",
      "data:text/html,hi",
      "/runtime",
    ]) {
      expect(extensionIframeSandbox(runtimeUrl, host).split(" ")).not.toContain("allow-same-origin");
    }
  });
});
