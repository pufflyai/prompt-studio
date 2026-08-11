import { describe, expect, test } from "bun:test";
import { formatDesktopDiagnostics } from "./diagnostics";

describe("desktop diagnostics", () => {
  test("includes actionable metadata without secrets", () => {
    const diagnostics = formatDesktopDiagnostics(
      {
        appVersion: "0.25.2",
        platform: "darwin",
        arch: "arm64",
        state: "recovery",
        runtimeOrigin: "http://127.0.0.1:43127?token=runtime-secret",
        runtimePid: 1234,
        ownerType: "desktop",
        logPath: "/tmp/pstdio/logs.jsonl",
        detail: "Authorization: Bearer runtime-secret",
      },
      ["runtime-secret"],
    );

    expect(diagnostics).toContain("appVersion: 0.25.2");
    expect(diagnostics).toContain("runtimePid: 1234");
    expect(diagnostics).not.toContain("runtime-secret");
    expect(diagnostics).toContain("[Redacted]");
  });
});
