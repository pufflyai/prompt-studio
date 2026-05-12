import { describe, expect, test } from "bun:test";
import { createDiagnosticRegistry } from "./diagnostic-registry";

describe("createDiagnosticRegistry", () => {
  test("records diagnostics by severity and resource", () => {
    const diagnostics = createDiagnosticRegistry();

    diagnostics.report(
      {
        id: "d1",
        source: "extension-lab.webview",
        severity: "error",
        message: "Webview failed to load",
        resource: { kind: "extension-lab.webview", uri: "pstdio://extension/pstdio.extension-lab/webview/faulty" },
      },
      { source: "extension", ownerId: "pstdio.extension-lab" },
    );

    expect(diagnostics.listDiagnostics({ severity: "error" })).toMatchObject([{ id: "d1" }]);
    expect(
      diagnostics.listDiagnostics({ resourceUri: "pstdio://extension/pstdio.extension-lab/webview/faulty" }),
    ).toHaveLength(1);
  });
});
