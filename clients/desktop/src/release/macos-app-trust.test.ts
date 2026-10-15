import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyMacOSAppTrust } from "./macos-app-trust";

describe("macOS desktop trust", () => {
  test.skipIf(process.platform !== "darwin")(
    "rejects an intact ad hoc signed app with the production bundle identifier",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "pstdio-untrusted-app-"));
      try {
        const app = join(root, "Prompt Studio.app");
        const contents = join(app, "Contents");
        mkdirSync(join(contents, "MacOS"), { recursive: true });
        copyFileSync("/usr/bin/true", join(contents, "MacOS", "fixture"));
        writeFileSync(
          join(contents, "Info.plist"),
          '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>' +
            "<key>CFBundleIdentifier</key><string>studio.prompt.desktop</string>" +
            "<key>CFBundleExecutable</key><string>fixture</string>" +
            "<key>CFBundlePackageType</key><string>APPL</string></dict></plist>",
        );
        const signed = spawnSync("codesign", ["--force", "--sign", "-", app], { encoding: "utf8" });
        expect(signed.status, signed.stderr).toBe(0);
        const integrity = spawnSync("codesign", ["--verify", "--deep", "--strict", app], { encoding: "utf8" });
        expect(integrity.status, integrity.stderr).toBe(0);

        await expect(verifyMacOSAppTrust(app)).rejects.toThrow("macOS application trust verification failed");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("requires the Prompt Studio Developer ID identity for both application and runtime", async () => {
    const calls: string[][] = [];
    await verifyMacOSAppTrust("/candidate/Prompt Studio.app", async (command, args) => {
      calls.push([command, ...args]);
      return { code: 0, stdout: "", stderr: "" };
    });
    const signatures = calls.filter(([command]) => command === "codesign");
    expect(signatures).toHaveLength(2);
    for (const [index, identifier] of ["studio.prompt.desktop", "studio.prompt.desktop.runtime"].entries()) {
      const call = signatures[index]!;
      const requirement = call[call.indexOf("--test-requirement") + 1]!;
      expect(requirement).toContain(`identifier "${identifier}"`);
      expect(requirement).toContain("anchor apple generic");
      expect(requirement).toContain("certificate leaf[field.1.2.840.113635.100.6.1.13]");
      expect(requirement).toContain('certificate leaf[subject.OU] = "XDNDHQS38D"');
    }
    expect(signatures[1]?.at(-1)).toBe("/candidate/Prompt Studio.app/Contents/Resources/bin/pstdio");
    expect(calls.at(-2)?.slice(0, 3)).toEqual(["xcrun", "stapler", "validate"]);
    expect(calls.at(-1)).toEqual([
      "spctl",
      "--assess",
      "--type",
      "execute",
      "--verbose=2",
      "/candidate/Prompt Studio.app",
    ]);
  });

  test.each(["application", "runtime", "staple", "Gatekeeper"])("stops when %s verification fails", async (phase) => {
    let calls = 0;
    const failureIndex = ["application", "runtime", "staple", "Gatekeeper"].indexOf(phase);
    await expect(
      verifyMacOSAppTrust("/candidate/app", async () => {
        const failed = calls++ === failureIndex;
        return { code: failed ? 1 : 0, stdout: "", stderr: failed ? "untrusted fixture" : "" };
      }),
    ).rejects.toThrow("untrusted fixture");
    expect(calls).toBe(failureIndex + 1);
  });
});
