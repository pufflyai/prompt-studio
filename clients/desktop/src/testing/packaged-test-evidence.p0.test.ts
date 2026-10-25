import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachPackagedLogs, startupFailure } from "./packaged-test-evidence";

test("preserves full redacted runtime files beyond the old tail limit", async () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-evidence-"));
  const output = mkdtempSync(join(tmpdir(), "desktop-evidence-output-"));
  try {
    const secret = "fixture-runtime-token";
    const log = `first entry ${secret}\n${"entry\n".repeat(10_000)}last entry\n`;
    for (const name of ["logs.jsonl", "desktop-runtime.log"]) writeFileSync(join(home, name), log);
    const attachments: Array<{ name: string; path?: string }> = [];
    await attachPackagedLogs(home, [secret], {
      outputPath: (...parts: string[]) => join(output, ...parts),
      attach: async (name: string, attachment: { path?: string }) => {
        attachments.push({ name, ...attachment });
      },
    });
    expect(attachments).toHaveLength(2);
    for (const attachment of attachments) {
      const saved = readFileSync(attachment.path!, "utf8");
      expect(saved).toContain("first entry");
      expect(saved).toContain("last entry");
      expect(saved).not.toContain(secret);
      expect(saved.length).toBeGreaterThan(32_000);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(output, { recursive: true, force: true });
  }
});

test("startup errors contain the last fifty runtime lines with credentials redacted", () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-startup-evidence-"));
  try {
    const lines = Array.from({ length: 80 }, (_, index) => `runtime line ${index} secret-token`);
    writeFileSync(join(home, "desktop-runtime.log"), `${lines.join("\n")}\n`);
    const failure = startupFailure(new Error("startup failed"), home, ["secret-token"]);
    expect(failure.message).toContain("startup failed");
    expect(failure.message).toContain("runtime line 30");
    expect(failure.message).toContain("runtime line 79");
    expect(failure.message).not.toContain("runtime line 29");
    expect(failure.message).not.toContain("secret-token");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("startup failure diagnostics do not expose the original credential-bearing error", () => {
  const failure = startupFailure(new Error("fixture-token startup failed"), tmpdir(), ["fixture-token"]);
  expect(`${failure.message}\n${failure.stack}\n${String(failure.cause)}`).not.toContain("fixture-token");
});
