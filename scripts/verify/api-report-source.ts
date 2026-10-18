import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runApiCommand = (root: string, command: string[], env = process.env) => {
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd: root,
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command.join(" ")} failed in ${root}:\n${result.error?.message ?? ""}${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout.trim();
};

export const readApiEntries = (root: string) => {
  const sdk = join(root, "packages/sdk");
  const inventory = join(sdk, "api-report-entries.json");
  if (existsSync(inventory)) return JSON.parse(readFileSync(inventory, "utf8")) as string[];

  // Releases before the public inventory treated every exported subpath as public.
  const manifest = JSON.parse(readFileSync(join(sdk, "package.json"), "utf8"));
  return Object.keys(manifest.exports).map((entry) => entry.replace(/^\.\//, ""));
};

export const withReleaseSource = <T>(root: string, ref: string, action: (source: string) => T) => {
  const temporary = mkdtempSync(join(tmpdir(), "pstdio-api-release-"));
  const source = join(temporary, "source");
  try {
    mkdirSync(source);
    const archive = join(temporary, "source.tar");
    runApiCommand(root, ["git", "archive", "--format=tar", `--output=${archive}`, ref]);
    runApiCommand(source, ["tar", "-xf", archive]);
    // Declaration generation does not need runtime install hooks from historical releases.
    runApiCommand(source, ["bun", "install", "--frozen-lockfile", "--ignore-scripts"]);
    return action(realpathSync(source));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
