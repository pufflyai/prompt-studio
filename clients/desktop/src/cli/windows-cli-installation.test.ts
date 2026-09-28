import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { WindowsCliInstallation } from "./windows-cli-installation";
import { updateWindowsPath } from "./windows-path";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-cli-"));
  roots.push(root);
  const installRoot = join(root, "Person's Å & %test% !", "PromptStudio");
  let path = "C:\\Existing CLI;%USERPROFILE%\\bin";
  const version = (name: string) => {
    const binary = join(installRoot, `app-${name}`, "resources", "bin", "pstdio.exe");
    mkdirSync(dirname(binary), { recursive: true });
    copyFileSync(process.execPath, binary);
    return new WindowsCliInstallation({
      installRoot,
      binary,
      updatePath: async (directory, action) => {
        path = updateWindowsPath(path, directory, action);
      },
    });
  };
  return { root, installRoot, version, path: () => path, command: join(installRoot, "bin", "pst.cmd") };
};

test("installs and removes the Windows command without changing unrelated PATH entries", async () => {
  const { version, installRoot, command, path } = fixture();
  const installation = version("1.0.0");
  const previousPath = path();
  expect(await installation.install()).toBe("installed");
  expect(existsSync(command)).toBe(true);
  expect(path()).toBe(`${previousPath};${join(installRoot, "bin")}`);
  expect(await installation.install()).toBe("installed");
  await installation.uninstall();
  expect(existsSync(command)).toBe(false);
  expect(path()).toBe(previousPath);
  await installation.uninstall();
  expect(path()).toBe(previousPath);
});

test("preserves an independently owned Windows command and PATH", async () => {
  const { version, command, path } = fixture();
  const installation = version("1.0.0");
  const previousPath = path();
  mkdirSync(dirname(command), { recursive: true });
  writeFileSync(command, "independent CLI");
  expect(await installation.install()).toBe("conflict");
  await installation.uninstall();
  expect(existsSync(command)).toBe(true);
  expect(path()).toBe(previousPath);
});

test.skipIf(process.platform !== "win32")(
  "runs the Windows command after updates with its arguments, cwd, and exit code",
  async () => {
    const { root, installRoot, version } = fixture();
    await version("1.0.0").install();
    const next = version("2.0.0");
    await next.install();
    rmSync(join(installRoot, "app-1.0.0"), { recursive: true });
    const probe = join(root, "probe.ts");
    writeFileSync(
      probe,
      "console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) })); process.exit(7);",
    );
    const result = spawnSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/v:off", "/s", "/c", 'pst probe.ts "a b" "Å & !" --flag'],
      {
        cwd: root,
        windowsVerbatimArguments: true,
        env: { ...process.env, PATH: `${join(installRoot, "bin")};${process.env.PATH}` },
        encoding: "utf8",
      },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(7);
    expect(JSON.parse(result.stdout)).toEqual({ cwd: root, args: ["a b", "Å & !", "--flag"] });
  },
);
