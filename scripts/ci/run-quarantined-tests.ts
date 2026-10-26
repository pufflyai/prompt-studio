import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { bunRunIdentity } from "./bun-test-evidence";
import { runCiChecks } from "./run-ci-checks";
import {
  browserQuarantineReportPath,
  matchesPlatform,
  quarantineDirectory,
  quarantineRegistry,
} from "./test-quarantine";
import { readWorkspacePackages } from "./workspace-packages";

export const quarantineGroups = (
  registry: typeof quarantineRegistry,
  packages: ReturnType<typeof readWorkspacePackages>,
  runner: string,
  platform: string,
  arch: string,
  scope?: string,
) => {
  const selected = registry.filter((entry) => entry.runner === runner && matchesPlatform(entry, platform, arch));
  if (selected.some((entry) => !packages.some((owner) => entry.file.startsWith(`${owner.dir}/`))))
    throw new Error("Quarantine case has no owning workspace");
  const owners = packages.filter(
    (owner) => !scope || scope.split(",").some((name) => name === owner.name || name === owner.dir),
  );
  if (scope && !owners.length) throw new Error("Unknown quarantine scope");
  return owners
    .map((owner) => ({ owner, entries: selected.filter((entry) => entry.file.startsWith(`${owner.dir}/`)) }))
    .filter((group) => group.entries.length);
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const args = process.argv.slice(2);
  const runner = args[0] ?? "bun";
  if (!["bun", "packaged-bun", "playwright", "playwright-ui", "packaged-desktop"].includes(runner))
    throw new Error("Choose a quarantine runner");
  const scopeAt = args.indexOf("--scope");
  const scope = scopeAt < 0 ? undefined : args[scopeAt + 1];
  if (scopeAt >= 0 && !scope) throw new Error("Missing quarantine scope");
  const groups = quarantineGroups(
    quarantineRegistry,
    readWorkspacePackages(root),
    runner,
    process.platform,
    process.arch,
    scope,
  );
  if (!groups.length) {
    console.log("No registered quarantine cases for this runner, platform and scope");
    process.exit(0);
  }
  const directories = groups.map(({ owner }) => quarantineDirectory(root, runner, owner.dir));
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  if (!args.includes("--prebuilt")) {
    const setup = [
      {
        id: "build-quarantine-owners",
        cwd: root,
        command: [
          "bun",
          "run",
          "build",
          "--",
          ...groups.flatMap(({ owner }) => ["--scope", owner.name]),
          "--include-dependencies",
        ],
      },
    ];
    if (runner === "packaged-bun" || runner === "playwright")
      setup.push({
        id: "compile-quarantine-cli",
        cwd: root,
        command: ["bun", "run", "--cwd", "scripts", "build:host"],
      });
    const result = await runCiChecks(setup, { priority: "P2", concurrency: 1 });
    if (result.outcome !== "success") process.exit(1);
  }
  if (runner === "packaged-desktop" && !args.includes("--prebuilt")) {
    const result = await runCiChecks(
      [{ id: "package-quarantine-desktop", cwd: root, command: ["bun", "run", "--cwd", "clients/desktop", "package"] }],
      { priority: "P2", concurrency: 1 },
    );
    if (result.outcome !== "success") process.exit(1);
  }
  const attempts = new Map<string, string>();
  for (const { owner } of groups) {
    const directory = quarantineDirectory(root, runner, owner.dir);
    mkdirSync(directory, { recursive: true });
    const token = randomUUID();
    attempts.set(owner.name, token);
    writeFileSync(join(directory, "attempt.json"), JSON.stringify({ ...bunRunIdentity(root), token }));
  }
  if (!["bun", "packaged-bun"].includes(runner)) rmSync(browserQuarantineReportPath(runner), { force: true });
  const checks = groups.flatMap(({ owner, entries }) => {
    const files = [...new Set(entries.map((entry) => relative(owner.dir, entry.file).replaceAll("\\", "/")))];
    const directory = quarantineDirectory(root, runner, owner.dir);
    if (owner.name === "pstdio-api")
      return files.map((file, index) => ({
        owner: owner.name,
        id: `quarantine:${owner.name}:${file}`,
        cwd: join(root, owner.dir),
        command: [
          "bun",
          join(root, "scripts/ci/run-bun-tests.ts"),
          "--conditions=source",
          "--timeout",
          "30000",
          "--silent",
          `./${file}`,
        ],
        evidence: join(directory, "files", String(index), "cases.json"),
      }));
    const manifest = JSON.parse(readFileSync(join(root, owner.dir, "package.json"), "utf8"));
    const scripts: Record<string, string> = {
      "packaged-bun": "test:packaged:cli",
      playwright: "test:packaged:browser",
      "playwright-ui": "test:ui",
      "packaged-desktop": "test:packaged",
    };
    const script = scripts[runner] ?? "test";
    if (!manifest.scripts?.[script]) throw new Error(`Missing ${script} runner for ${owner.name}`);
    const command = ["bun", "run", script, ...files.map((file) => `./${file}`)];
    // Preserve the existing Windows fixture allowances; source test limits stay unchanged elsewhere.
    if (
      process.platform === "win32" &&
      ["pstdio-db", "harness-codex", "pstdio-planner", "@pstdio/desktop"].includes(owner.name)
    )
      command.push("--timeout=15000");
    return [
      {
        owner: owner.name,
        id: `quarantine:${owner.name}`,
        cwd: join(root, owner.dir),
        command,
        evidence: join(directory, "cases.json"),
      },
    ];
  });
  let failed = false;
  for (const check of checks) {
    const result = await runCiChecks([check], {
      priority: "P2",
      concurrency: 1,
      env: {
        E2E_TEST_LANE: "quarantine",
        CI_QUARANTINE_ATTEMPT: attempts.get(check.owner)!,
        CI_PRIORITY: "P2",
        BUN_TEST_EVIDENCE_FILE: check.evidence,
        ...(check.owner === "pstdio-api"
          ? { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0" }
          : {}),
      },
    });
    if (result.outcome !== "success") failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}
