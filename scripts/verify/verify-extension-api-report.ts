/**
 * Keeps the checked-in public extension API report current, and checks that EXTENSION_API_VERSION
 * moved one step when the report changed since the last release.
 *
 * Run with `--write` to regenerate the report after changing the public extension API.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { checkExtensionApiReleaseStep } from "./extension-api-release-step";

const ROOT = path.resolve(import.meta.dir, "../..");
const SDK_DIR = path.join(ROOT, "packages/sdk");
const REPORT_DIR = "packages/sdk/api-report";
const REPORT_FILES = ["extensions.d.ts", "extensions-react.d.ts"];
const VERSION_FILE = "packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts";

const run = (command: string[], cwd = ROOT) => {
  const result = spawnSync(command[0]!, command.slice(1), { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
};

// Region comments name source files, so moving a file would otherwise look like an API change.
const normalizeReport = (report: string) =>
  `${report
    .split("\n")
    .filter((line) => !line.startsWith("//#region") && !line.startsWith("//#endregion"))
    .join("\n")
    .trim()}\n`;

const buildReport = () => {
  const result = spawnSync("bun", ["run", "build:api-report"], { cwd: SDK_DIR, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`build:api-report failed:\n${result.stdout}${result.stderr}`);

  return new Map(
    REPORT_FILES.map((file) => [
      file,
      normalizeReport(readFileSync(path.join(SDK_DIR, ".api-report/bundle", file), "utf8")),
    ]),
  );
};

const readCheckedInReport = (file: string) => {
  const reportPath = path.join(ROOT, REPORT_DIR, file);
  return existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
};

const readLastRelease = () => {
  const tag = run(["git", "describe", "--tags", "--match", "pstdio@*", "--abbrev=0", "HEAD"])?.trim();
  if (!tag) throw new Error("No pstdio@* release tag is reachable from HEAD. Fetch the tags and run again.");

  const versionSource = run(["git", "show", `${tag}:${VERSION_FILE}`]);
  const released = versionSource?.match(/EXTENSION_API_VERSION = "([^"]+)"/)?.[1];
  if (!released) throw new Error(`Could not read EXTENSION_API_VERSION at ${tag}.`);

  const reports = new Map(REPORT_FILES.map((file) => [file, run(["git", "show", `${tag}:${REPORT_DIR}/${file}`])]));
  return { tag, released, reports };
};

const main = () => {
  const write = process.argv.includes("--write");
  const built = buildReport();
  const errors: string[] = [];

  for (const [file, report] of built) {
    if (readCheckedInReport(file) === report) continue;
    if (write) {
      mkdirSync(path.join(ROOT, REPORT_DIR), { recursive: true });
      writeFileSync(path.join(ROOT, REPORT_DIR, file), report);
      console.log(`Updated ${REPORT_DIR}/${file}`);
    } else {
      errors.push(
        `${REPORT_DIR}/${file} does not match the public extension API. Run \`bun run verify:extension-api-report --write\` and commit the result.`,
      );
    }
  }

  const { tag, released, reports } = readLastRelease();
  const reportChanged = [...built].some(([file, report]) => reports.get(file) !== report);
  errors.push(...checkExtensionApiReleaseStep({ released, current: EXTENSION_API_VERSION, reportChanged }));

  if (errors.length > 0) {
    console.error(`Extension API report violations (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Extension API report OK: ${EXTENSION_API_VERSION} (last release ${tag} shipped ${released}).`);
};

if (import.meta.main) main();
