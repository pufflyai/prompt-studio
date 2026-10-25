import { mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { bunRunIdentity, junitCases, registeredUnselectedScope } from "./bun-test-evidence";
import { assertStableQuarantineExclusions, verifyQuarantineReport } from "./quarantine-reports";
import { priorityIgnorePatterns, readTestPriorities } from "./test-discovery";
import { bunTestSelection, narrowStablePattern, quarantineDirectory } from "./test-quarantine";
import cases from "./test-quarantine.json";

const root = realpathSync.native(resolve(import.meta.dir, "../.."));
const cwd = realpathSync.native(process.cwd());
const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const packageDir = relative(root, cwd).replaceAll("\\", "/");
const runner = packageDir === "packages/e2e" ? "packaged-bun" : "bun";
const priority = quarantine ? "P2" : (process.env.CI_PRIORITY ?? "P1");
if (!["P0", "P1", "P2", "P3"].includes(priority)) throw new Error(`Unknown test priority: ${priority}`);
const forwarded = process.argv.slice(2);
const packageCases = cases.filter((entry) => entry.runner === runner && entry.file.startsWith(`${packageDir}/`));
const scopedPaths = forwarded.filter(
  (arg) =>
    !arg.startsWith("-") &&
    (/\.test\.tsx?$/.test(arg) ||
      packageCases.some((entry) => {
        const file = relative(cwd, resolve(root, entry.file)).replaceAll("\\", "/");
        const path = arg.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
        return file === path || file.startsWith(`${path}/`);
      })),
);
const selection = bunTestSelection(
  cases,
  packageDir,
  process.platform,
  quarantine,
  runner,
  quarantine ? scopedPaths : undefined,
);
if (quarantine && !selection.files.length) {
  console.log(`No quarantined Bun tests for ${packageDir} on ${process.platform}.`);
} else {
  if (selection.files.length) {
    console.log(`${quarantine ? "Running" : "Separating"} quarantined tests: ${selection.files.join(", ")}`);
    console.log("Evidence and removal criteria: scripts/ci/test-quarantine.json");
  }
  const args: string[] = [];
  let suppliedReport: string | undefined;
  for (let index = 0; index < forwarded.length; index++) {
    const arg = forwarded[index]!;
    if (arg === "--bail") {
      if (/^\d+$/.test(forwarded[index + 1] ?? "")) index++;
      continue;
    }
    if (arg.startsWith("--bail=")) continue;
    if (arg === "--reporter-outfile") {
      suppliedReport = forwarded[++index];
      continue;
    }
    if (arg.startsWith("--reporter-outfile=")) {
      suppliedReport = arg.slice("--reporter-outfile=".length);
      continue;
    }
    if (arg === "--reporter") {
      index++;
      continue;
    }
    if (arg.startsWith("--reporter=")) continue;
    if (!quarantine || !scopedPaths.includes(arg)) args.push(arg);
  }
  const filterAt = args.findIndex((arg) => arg === "-t" || arg.startsWith("--test-name-pattern"));
  let pattern = selection.pattern;
  if (filterAt !== -1 && pattern) {
    if (quarantine) throw new Error("The quarantine lane selects registered cases itself; remove the name filter.");
    const equals = args[filterAt]!.indexOf("=");
    const filter = equals === -1 ? args[filterAt + 1] : args[filterAt]!.slice(equals + 1);
    args.splice(filterAt, equals === -1 ? 2 : 1);
    pattern = narrowStablePattern(pattern, filter!);
  }
  const defaultDirectory = quarantine
    ? quarantineDirectory(root, runner, packageDir)
    : resolve(
        root,
        "test-results/ci/bun",
        packageDir.replaceAll("../", "_"),
        `${process.env.GITHUB_JOB ?? "local"}-${process.pid}`,
      );
  const evidencePath = resolve(process.env.BUN_TEST_EVIDENCE_FILE ?? `${defaultDirectory}/cases.json`);
  const report = resolve(suppliedReport ?? `${dirname(evidencePath)}/results.xml`);
  mkdirSync(dirname(report), { recursive: true });
  mkdirSync(dirname(evidencePath), { recursive: true });
  rmSync(report, { force: true });
  rmSync(evidencePath, { force: true });
  if (quarantine) {
    const { assertNoQuarantineRetries } = await import("./quarantine-retries");
    for (const file of selection.files) assertNoQuarantineRetries(readFileSync(resolve(cwd, file), "utf8"), forwarded);
  }
  const timings = process.env.BUN_TEST_TIMINGS ?? `${dirname(evidencePath)}/timings.json`;
  const timingArgs = args.some((arg) => arg.startsWith("--timings"))
    ? []
    : [`--timings=${timings}`, "--update-timings"];
  const command = [
    "test",
    ...args,
    ...(quarantine ? [] : priorityIgnorePatterns(readTestPriorities())).map(
      (pattern) => `--path-ignore-patterns=${pattern}`,
    ),
    ...(priority === "P1" ? ["--bail=1"] : []),
    ...(quarantine ? selection.files.map((file) => `./${file}`) : []),
    ...(pattern ? ["--test-name-pattern", pattern] : []),
    "--reporter=junit",
    "--reporter-outfile",
    report,
    ...timingArgs,
  ];
  const child = Bun.spawn([process.execPath, ...command], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  let reported: ReturnType<typeof junitCases> = [];
  let reportError: string | null = null;
  try {
    const xml = await Bun.file(report).text();
    reported = junitCases(xml).map((entry) => {
      const file = relative(root, resolve(cwd, entry.file)).replaceAll("\\", "/");
      return { ...entry, file, id: `${file}${entry.id.slice(entry.file.length)}` };
    });
    if (quarantine) {
      const summary = verifyQuarantineReport(xml, selection.cases, root, cwd);
      if (exitCode !== 0 && summary.failures === 0) throw new Error("Quarantine failed outside its registered cases");
    } else assertStableQuarantineExclusions(reported, selection.cases);
  } catch (error) {
    reportError = String(error);
  }
  const complete =
    !reportError && reported.length > 0 && !(priority === "P1" && exitCode !== 0) && child.signalCode === null;
  const unselectedReason =
    !quarantine && complete && exitCode === 0
      ? registeredUnselectedScope(root, cwd, args, cases, runner, reported)
      : null;
  await Bun.write(
    evidencePath,
    `${JSON.stringify(
      {
        ...bunRunIdentity(root),
        quarantineAttempt: quarantine ? process.env.CI_QUARANTINE_ATTEMPT : undefined,
        priority,
        packageDir,
        lane: quarantine ? "quarantine" : "stable",
        selection: {
          arguments: forwarded,
          files: quarantine ? selection.files : null,
          reason: process.env.CI_SELECTION_REASON ?? "package command",
        },
        discovery: "junit-reported-cases",
        unreportedSelectedCases: complete ? 0 : null,
        cases: reported,
        reportedFiles: [...new Set(reported.map((entry) => entry.file))],
        executedFiles: [...new Set(reported.filter((entry) => entry.outcome !== "skipped").map((entry) => entry.file))],
        executedCases: reported.filter((entry) => entry.outcome !== "skipped").length,
        complete,
        ...(unselectedReason ? { outcome: "unselected", unselectedReason } : {}),
        exitCode,
        signal: child.signalCode,
        reportError,
        report,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = reportError || !reported.length ? 1 : exitCode;
}
