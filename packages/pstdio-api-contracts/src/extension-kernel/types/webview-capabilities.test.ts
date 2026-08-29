import { describe, expect, test } from "bun:test";
import { WEBVIEW_DECLARABLE_CAPABILITIES, WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES } from "./webview-capabilities";

describe("webview capability contracts", () => {
  test("terminal sessions are declarable by extension webviews", () => {
    expect(WEBVIEW_DECLARABLE_CAPABILITIES).toContain("terminal.session");
  });

  test("artifact reads are declarable per mount", () => {
    expect(WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES).toContain("artifacts.read");
  });
});
