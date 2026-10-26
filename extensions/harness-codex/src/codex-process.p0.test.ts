import { describe, expect, test } from "bun:test";
import { resolveCodexCommand } from "./codex-process";

describe("resolveCodexCommand", () => {
  test("prefers a CLI on PATH over the private installation", () => {
    expect(resolveCodexCommand({ which: () => "/tools/codex", managed: () => "/private/codex" })).toBe("/tools/codex");
  });

  test("uses the private installation when Codex is missing from PATH", () => {
    expect(resolveCodexCommand({ which: () => null, managed: () => "/private/codex" })).toBe("/private/codex");
  });

  test("keeps the command name when neither installation is available", () => {
    expect(resolveCodexCommand({ which: () => null, managed: () => null })).toBe("codex");
  });

  test("bypasses the Windows npm shim when the native binary is installed", () => {
    const native =
      "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe";

    const command = resolveCodexCommand({
      platform: "win32",
      arch: "x64",
      which: () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
      exists: (candidate) => candidate === native,
    });

    expect(command).toBe(native);
  });

  test("switches a Windows .ps1 shim to its sibling .cmd", () => {
    const cmd = "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd";

    const command = resolveCodexCommand({
      platform: "win32",
      which: () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.ps1",
      exists: (candidate) => candidate === cmd,
    });

    expect(command).toBe(cmd);
  });
});
