import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { bunRunIdentity } from "./bun-test-evidence";
import {
  verifyBunQuarantineCases,
  verifyPlaywrightQuarantineReport,
  verifyQuarantineAttempt,
} from "./quarantine-reports";
import { selectedQuarantineRegistry } from "./quarantine-test-files";
import { quarantineGroups } from "./run-quarantined-tests";
import { browserQuarantineReportPath, quarantineDirectory } from "./test-quarantine";
import { readWorkspacePackages } from "./workspace-packages";

const root = resolve(import.meta.dir, "../..");
const registry = selectedQuarantineRegistry(root, process.argv);
const runner = process.argv[2]!;
const scopeAt = process.argv.indexOf("--scope");
const scope = scopeAt < 0 ? undefined : process.argv[scopeAt + 1];
if (scopeAt >= 0 && !scope) throw new Error("Missing quarantine scope");
const record = (name: string, result: { executed: number; failures: number }) => {
  const line = `${name}: ${result.executed} quarantined cases executed once; ${result.failures} failed.\n`;
  console.log(line.trim());
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line);
};
if (runner === "bun" || runner === "packaged-bun") {
  const identity = bunRunIdentity(root);
  for (const { owner, entries } of quarantineGroups(
    registry,
    readWorkspacePackages(root),
    runner,
    process.platform,
    process.arch,
    scope,
  )) {
    const directory = quarantineDirectory(root, runner, owner.dir);
    const attempt = await Bun.file(resolve(directory, "attempt.json")).json();
    const paths = Array.from(new Bun.Glob("**/cases.json").scanSync({ cwd: directory }));
    const reports = await Promise.all(paths.map((path) => Bun.file(resolve(directory, path)).json()));
    if (
      !reports.length ||
      reports.some(
        (report) =>
          !report.complete ||
          report.reportError ||
          report.signal ||
          report.sourceSha !== identity.sourceSha ||
          report.policyDigest !== identity.policyDigest ||
          report.platform !== identity.platform ||
          report.arch !== identity.arch,
      )
    )
      throw new Error(`Incomplete or stale quarantine evidence: ${owner.name}`);
    for (const report of reports) verifyQuarantineAttempt(attempt, identity, report.quarantineAttempt);
    record(
      owner.name,
      verifyBunQuarantineCases(
        reports.flatMap((report) => report.cases),
        entries,
      ),
    );
  }
} else if (
  ["playwright", "playwright-ui", "packaged-desktop", "packaged-desktop-benchmark", "workbench-benchmark"].includes(
    runner,
  )
) {
  const groups = quarantineGroups(registry, readWorkspacePackages(root), runner, process.platform, process.arch, scope);
  if (!groups.length) {
    record(runner, { executed: 0, failures: 0 });
    process.exit(0);
  }
  const { owner } = groups[0]!;
  const expected = groups.flatMap((group) => group.entries);
  const attempt = await Bun.file(resolve(quarantineDirectory(root, runner, owner.dir), "attempt.json")).json();
  const report = await Bun.file(browserQuarantineReportPath(runner)).json();
  verifyQuarantineAttempt(attempt, bunRunIdentity(root), report.config.metadata?.quarantineAttempt);
  record(runner, verifyPlaywrightQuarantineReport(report, expected, root));
} else throw new Error("Choose a registered quarantine runner");
