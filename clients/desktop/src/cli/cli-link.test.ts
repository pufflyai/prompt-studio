import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cliInstallScript, cliRemoveScript } from "./cli-link";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "desktop cli's "));
  roots.push(root);
  const binary = join(root, "Prompt Studio.app", "Contents", "Resources", "bin", "pstdio");
  const command = join(root, "bin", "pst");
  mkdirSync(dirname(binary), { recursive: true });
  symlinkSync(process.execPath, binary);
  return { root, binary, command };
};

const runScript = (script: string) => spawnSync("/bin/sh", ["-c", script], { encoding: "utf8" });

test.skipIf(process.platform === "win32")(
  "installs pst on PATH and preserves its arguments and working directory",
  () => {
    const { root, binary, command } = fixture();
    const result = runScript(cliInstallScript({ binary, command }));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const invocation = spawnSync(
      "pst",
      ["-e", "console.log(JSON.stringify([process.cwd(), ...process.argv.slice(1)]))", "a b", "--flag"],
      {
        cwd: root,
        env: { ...process.env, PATH: dirname(command) },
        encoding: "utf8",
      },
    );
    expect(invocation.status).toBe(0);
    expect(JSON.parse(invocation.stdout)).toEqual([realpathSync(root), "a b", "--flag"]);
    expect(readlinkSync(command)).toBe(binary);
  },
);

test.skipIf(process.platform === "win32")(
  "reinstalling preserves the desktop link and follows a replaced runtime",
  () => {
    const { binary, command } = fixture();
    const script = cliInstallScript({ binary, command });
    expect(runScript(script).status).toBe(0);
    expect(runScript(script).status).toBe(0);
    rmSync(binary);
    symlinkSync(process.execPath, binary);
    expect(spawnSync(command, ["--version"]).status).toBe(0);
  },
);

test.skipIf(process.platform === "win32")("preserves another installation's pst command", () => {
  const { binary, command } = fixture();
  mkdirSync(dirname(command), { recursive: true });
  writeFileSync(command, "existing command");
  expect(runScript(cliInstallScript({ binary, command })).status).toBe(0);
  expect(runScript(cliRemoveScript({ binary, command })).status).toBe(0);
  expect(existsSync(command)).toBe(true);
  expect(readFileSync(command, "utf8")).toBe("existing command");
});

test.skipIf(process.platform === "win32")("removes only the desktop-owned command when uninstalling", () => {
  const { binary, command } = fixture();
  expect(runScript(cliInstallScript({ binary, command })).status).toBe(0);
  rmSync(binary);
  expect(runScript(cliRemoveScript({ binary, command })).status).toBe(0);
  expect(() => readlinkSync(command)).toThrow();
  expect(runScript(cliRemoveScript({ binary, command })).status).toBe(0);
});
