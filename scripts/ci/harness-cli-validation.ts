import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bunRunIdentity } from "./bun-test-evidence";
import { verifyQuarantineAttempt, verifyQuarantineReport } from "./quarantine-reports";
import { assertNoQuarantineRetries } from "./quarantine-retries";
import { matchesPlatform, quarantinePattern, quarantineRegistry } from "./test-quarantine";

export const reuseMinimumLane = (requested: string, minimum: string, resolved: string, minimumScheduled: boolean) =>
  requested === "latest" && minimumScheduled && minimum === resolved;

export const installedHarnessSelection = (
  extension: string,
  version: string,
  platform = process.platform,
  arch = process.arch,
) => {
  const file = `extensions/${extension}/src/installed-cli.p0.test.ts`;
  const cases = quarantineRegistry.filter(
    (entry) =>
      entry.runner === "installed-harness" &&
      entry.file === file &&
      entry.cliVersion === version &&
      matchesPlatform(entry, platform, arch),
  );
  const pattern = quarantinePattern(cases, "installed-harness", platform, arch);
  return { file, cases, quarantine: pattern, stable: pattern ? `^(?!.*${pattern}).*$` : ".*" };
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const extension = process.env.EXTENSION!;
  const version = process.env.CLI_RESOLVED_VERSION!;
  if (!/^harness-[a-z-]+$/.test(extension) || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version))
    throw new Error("Missing or invalid installed CLI identity");
  const selection = installedHarnessSelection(extension, version);
  const mode = process.argv[2];
  if (mode === "plan") {
    const reuse = reuseMinimumLane(
      process.env.VERSION!,
      process.env.CLI_MINIMUM_VERSION!,
      version,
      process.env.MINIMUM_LANE_SCHEDULED === "true",
    );
    const output = {
      version,
      reuse_minimum: String(reuse),
      quarantine: String(selection.cases.length > 0),
      stable_pattern: selection.stable,
    };
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        Object.entries(output)
          .map(([key, value]) => `${key}=${value}\n`)
          .join(""),
      );
    console.log(JSON.stringify({ extension, requested: process.env.VERSION, ...output }));
    if (reuse && process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\n${extension} latest resolves to ${version}; the required minimum lane owns this execution.\n`,
      );
  } else {
    if (!selection.cases.length) throw new Error("No registered installed CLI quarantine");
    const directory = join(root, "test-results/quarantine/installed-harness", extension, version);
    const cwd = join(root, "extensions", extension);
    const attemptPath = join(directory, "attempt.json");
    const resultPath = join(directory, "result.json");
    const reportPath = join(directory, "junit.xml");
    const identity = { ...bunRunIdentity(root), version };
    if (mode === "run-quarantine") {
      assertNoQuarantineRetries(readFileSync(join(root, selection.file), "utf8"), []);
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      const token = randomUUID();
      writeFileSync(attemptPath, JSON.stringify({ ...identity, token }));
      const result = spawnSync(
        process.execPath,
        [
          "test",
          "src/installed-cli.p0.test.ts",
          "--test-name-pattern",
          selection.quarantine!,
          "--reporter=junit",
          "--reporter-outfile",
          reportPath,
        ],
        {
          cwd,
          env: { ...process.env, INSTALLED_CLI_TESTS: "1" },
          stdio: "inherit",
        },
      );
      writeFileSync(
        resultPath,
        JSON.stringify({
          ...identity,
          token,
          exitCode: result.status,
          signal: result.signal,
          setupError: result.error?.message,
        }),
      );
      process.exitCode = result.status ?? 1;
    } else if (mode === "verify-quarantine") {
      const attempt = JSON.parse(readFileSync(attemptPath, "utf8"));
      const result = JSON.parse(readFileSync(resultPath, "utf8"));
      verifyQuarantineAttempt(attempt, identity, result.token);
      verifyQuarantineAttempt(result, identity, attempt.token);
      if (
        attempt.version !== version ||
        result.version !== version ||
        result.signal ||
        result.setupError ||
        ![0, 1].includes(result.exitCode)
      )
        throw new Error("Incomplete installed CLI quarantine execution");
      const summary = verifyQuarantineReport(readFileSync(reportPath, "utf8"), selection.cases, root, cwd);
      console.log(JSON.stringify({ ...identity, ...summary }));
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `\n${extension} ${version} quarantine: ${summary.executed} executed once, ${summary.failures} failed.\n`,
        );
    } else throw new Error("Choose plan, run-quarantine or verify-quarantine");
  }
}
