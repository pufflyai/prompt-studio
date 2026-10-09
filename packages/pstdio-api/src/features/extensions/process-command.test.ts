import { describe, expect, test } from "bun:test";
import { escapeForCmd, resolveProcessCommand } from "./process-command";

describe("resolveProcessCommand", () => {
  test("resolves bare executable commands before spawning", () => {
    const resolved = resolveProcessCommand(["codex", "--version"], (name) =>
      name === "codex" ? "C:\\Tools\\codex.exe" : null,
    );

    expect(resolved).toEqual({ argv: ["C:\\Tools\\codex.exe", "--version"] });
  });

  test("wraps Windows command shims through cmd.exe with escaped, verbatim args", () => {
    const shim = "C:\\Users\\me\\AppData\\Roaming\\npm\\tool.cmd";
    const resolved = resolveProcessCommand(
      ["tool", "a & b", 'q"x'],
      (name) => (name === "tool" ? shim : null),
      "win32",
      "cmd.exe",
    );

    expect(resolved.windowsVerbatimArguments).toBe(true);
    expect(resolved.argv.slice(0, 4)).toEqual(["cmd.exe", "/d", "/s", "/c"]);

    const line = resolved.argv[4] ?? "";
    // The whole command line is wrapped for `cmd /c`.
    expect(line.startsWith('"')).toBe(true);
    expect(line.endsWith('"')).toBe(true);
    // The executable is parsed once; arguments pass through the npm shim too.
    expect(line).toContain(escapeForCmd(shim, false));
    expect(line).toContain(escapeForCmd("a & b", true));
    expect(line).toContain(escapeForCmd('q"x', true));
    expect(line).not.toMatch(/[^^]&(?!amp)/); // no unescaped `&`
  });

  test("switches a Windows .ps1 shim to its sibling .cmd", () => {
    const ps1 = "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.ps1";
    const cmd = "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd";
    const resolved = resolveProcessCommand(
      ["codex", "--version"],
      (name) => (name === "codex" ? ps1 : null),
      "win32",
      "cmd.exe",
      (path) => path === cmd,
    );

    expect(resolved.argv.slice(0, 4)).toEqual(["cmd.exe", "/d", "/s", "/c"]);
    expect(resolved.windowsVerbatimArguments).toBe(true);
    expect(resolved.argv[4]).toContain(escapeForCmd(cmd, false));
  });

  test("runs a lone Windows .ps1 shim through powershell", () => {
    const ps1 = "C:\\Tools\\only.ps1";
    const resolved = resolveProcessCommand(
      ["only", "--version"],
      (name) => (name === "only" ? ps1 : null),
      "win32",
      "cmd.exe",
      () => false,
    );

    expect(resolved).toEqual({
      argv: [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        ps1,
        "--version",
      ],
    });
  });

  test("leaves Unix path commands unchanged", () => {
    const resolved = resolveProcessCommand(["./tools/codex", "--version"], () => "ignored", "linux");

    expect(resolved).toEqual({ argv: ["./tools/codex", "--version"] });
  });

  test("wraps an explicit Windows command path relative to the child directory", () => {
    const resolved = resolveProcessCommand(
      [".\\tools\\codex.cmd", "--version"],
      () => null,
      "win32",
      "cmd.exe",
      () => false,
      "C:\\project",
    );
    expect(resolved.windowsVerbatimArguments).toBe(true);
    expect(resolved.argv[4]).toContain(escapeForCmd("C:\\project\\tools\\codex.cmd", false));
  });

  test("keeps the original command when resolution fails", () => {
    const resolved = resolveProcessCommand(["missing", "--version"], () => null);

    expect(resolved).toEqual({ argv: ["missing", "--version"] });
  });
});

describe("escapeForCmd", () => {
  test("leaves a plain token quoted only", () => {
    expect(escapeForCmd("hello", false)).toBe('^"hello^"');
  });

  test("escapes cmd metacharacters so they cannot inject a command", () => {
    expect(escapeForCmd("a & b", false)).toBe('^"a^ ^&^ b^"');
    expect(escapeForCmd("%PATH%", false)).toBe('^"^%PATH^%^"');
  });

  test("doubles the metacharacter escape for shims that re-parse %*", () => {
    expect(escapeForCmd("a&b", true)).toBe('^^^"a^^^&b^^^"');
  });

  test("doubles backslashes before an embedded quote", () => {
    expect(escapeForCmd('a\\"b', false)).toBe('^"a\\\\\\^"b^"');
  });
});
