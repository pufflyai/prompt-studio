import { mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { bunTestSelection, narrowStablePattern, verifyQuarantineReport } from "./test-quarantine";
import cases from "./test-quarantine.json";

const root = resolve(import.meta.dir, "../..");
const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const packageDir = relative(root, process.cwd()).replaceAll("\\", "/");
const runner = packageDir === "packages/e2e" ? "packaged-bun" : "bun";
const selection = bunTestSelection(cases, packageDir, process.platform, quarantine, runner);
if (quarantine && !selection.files.length) {
  console.log(`No quarantined Bun tests for ${packageDir} on ${process.platform}.`);
} else {
  if (selection.files.length) {
    console.log(`${quarantine ? "Running" : "Separating"} quarantined tests: ${selection.files.join(", ")}`);
    console.log("Evidence and removal criteria: scripts/ci/test-quarantine.json");
  }
  const args = process.argv.slice(2);
  const filterAt = args.findIndex((arg) => arg === "-t" || arg.startsWith("--test-name-pattern"));
  let pattern = selection.pattern;
  if (filterAt !== -1 && pattern) {
    if (quarantine) throw new Error("The quarantine lane selects registered cases itself; remove the name filter.");
    const equals = args[filterAt].indexOf("=");
    const filter = equals === -1 ? args[filterAt + 1] : args[filterAt].slice(equals + 1);
    args.splice(filterAt, equals === -1 ? 2 : 1);
    pattern = narrowStablePattern(pattern, filter);
  }
  const report = resolve(root, "test-results/quarantine", packageDir, "results.xml");
  if (quarantine) mkdirSync(resolve(report, ".."), { recursive: true });
  const child = Bun.spawn(
    [
      process.execPath,
      "test",
      ...args,
      ...(quarantine ? selection.files : []),
      ...(pattern ? ["--test-name-pattern", pattern] : []),
      ...(quarantine ? ["--reporter=junit", "--reporter-outfile", report] : []),
    ],
    { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exitCode = await child.exited;
  if (quarantine && process.exitCode === 0) verifyQuarantineReport(await Bun.file(report).text(), selection.count);
}
