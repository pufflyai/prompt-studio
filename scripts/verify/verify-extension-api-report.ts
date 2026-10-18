import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { changedApiEntries, normalizeReport } from "./api-report";
import { readApiEntries, runApiCommand, withReleaseSource } from "./api-report-source";
import { checkExtensionApiReleaseStep } from "./extension-api-release-step";

const ROOT = path.resolve(import.meta.dir, "../..");
const VERSION_FILE = "packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts";

const readVersion = (source: string) => {
  const version = source.match(/EXTENSION_API_VERSION = "([^"]+)"/)?.[1];
  if (!version) throw new Error("Could not read EXTENSION_API_VERSION.");
  return version;
};

const buildReport = (source: string, output: string) => {
  mkdirSync(output, { recursive: true });
  const entries = readApiEntries(source);
  if (entries.length > 0) {
    // One generator owns both sides; each source tree resolves its own locked type dependencies.
    try {
      runApiCommand(
        ROOT,
        [
          path.join(ROOT, "packages/sdk/node_modules/.bin/rolldown"),
          "-c",
          "packages/sdk/rolldown.api-report.config.ts",
        ],
        {
          ...process.env,
          PSTDIO_API_REPORT_SOURCE: source,
          PSTDIO_API_REPORT_OUTPUT: output,
          PSTDIO_API_REPORT_ENTRIES: JSON.stringify(entries),
        },
      );
    } catch (error) {
      throw new Error(`API report generation failed for ${source}:\n${error}`);
    }
  }

  return new Map(
    entries.map((entry) => {
      const file = path.join(output, `${entry.replaceAll("/", "-")}.d.ts`);
      const report = normalizeReport(readFileSync(file, "utf8"));
      writeFileSync(file, report);
      return [entry, report];
    }),
  );
};

const writeDiff = (output: string) => {
  const diff = spawnSync("git", ["diff", "--no-index", "--no-prefix", "--", "released", "proposed"], {
    cwd: output,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (diff.status !== 0 && diff.status !== 1) throw new Error(`Could not produce the API diff: ${diff.stderr}`);
  writeFileSync(path.join(output, "api.diff"), diff.stdout);
};

export const verifyApiReport = (root = ROOT) => {
  const output = path.join(root, ".api-report");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const tag = runApiCommand(root, ["git", "describe", "--tags", "--match", "pstdio@*", "--abbrev=0", "HEAD"]);
  const released = readVersion(runApiCommand(root, ["git", "show", `${tag}:${VERSION_FILE}`]));
  const current = readVersion(readFileSync(path.join(root, VERSION_FILE), "utf8"));
  const releasedReports = withReleaseSource(root, tag, (source) => buildReport(source, path.join(output, "released")));
  const proposedReports = buildReport(root, path.join(output, "proposed"));
  const changed = changedApiEntries(releasedReports, proposedReports);
  const main = spawnSync("git", ["show", `origin/main:${VERSION_FILE}`], { cwd: root, encoding: "utf8" });
  const onMain = main.status === 0 ? readVersion(main.stdout) : null;
  const errors = checkExtensionApiReleaseStep({ released, current, reportChanged: changed.length > 0, onMain });
  writeDiff(output);
  const summary = [
    "## Public SDK API comparison",
    "",
    `Baseline: ${tag} (API ${released}). Proposed API: ${current}.`,
    "",
    changed.length > 0
      ? `Changed entrypoints: ${changed.map((entry) => `\`${entry}\``).join(", ")}.`
      : "No public type changes.",
    "",
    "Download the `sdk-api-report` CI artifact for `api.diff` and both generated reports.",
    "Locally, these files are in `.api-report/`.",
    "",
    ...errors.map((error) => `- ${error}`),
    "",
    "Reviewers must classify changes as breaking or additive; this check compares declarations only.",
    "",
  ].join("\n");
  writeFileSync(path.join(output, "summary.md"), summary);
  return { tag, released, current, changed, errors, summary };
};

if (import.meta.main) {
  try {
    const result = verifyApiReport();
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary);
    console.log(result.summary);
    process.exitCode = result.errors.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
