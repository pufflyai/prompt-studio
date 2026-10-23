import { relative, resolve } from "node:path";
import { bunTestSelection } from "./test-quarantine";
import cases from "./test-quarantine.json";

const root = resolve(import.meta.dir, "../..");
const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const packageDir = relative(root, process.cwd()).replaceAll("\\", "/");
const selection = bunTestSelection(cases, packageDir, process.platform, quarantine);
if (quarantine && !selection.files.length) {
  console.log(`No quarantined Bun tests for ${packageDir} on ${process.platform}.`);
} else {
  if (selection.files.length) {
    console.log(`${quarantine ? "Running" : "Separating"} quarantined tests: ${selection.files.join(", ")}`);
    console.log("Evidence and removal criteria: scripts/ci/test-quarantine.json");
  }
  const args = process.argv.slice(2);
  if (selection.pattern && args.some((arg) => arg === "-t" || arg.startsWith("--test-name-pattern"))) {
    throw new Error("Use E2E_TEST_LANE=quarantine to select registered flaky cases; do not override the lane pattern.");
  }
  const report = resolve(root, "test-results/quarantine", packageDir, "results.xml");
  if (quarantine) mkdirSync(resolve(report, ".."), { recursive: true });
  const child = Bun.spawn(
    [
      process.execPath,
      "test",
      ...args,
      ...(quarantine ? selection.files : []),
      ...(selection.pattern ? ["--test-name-pattern", selection.pattern] : []),
      ...(quarantine ? ["--reporter=junit", "--reporter-outfile", report] : []),
    ],
    { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exitCode = await child.exited;
}

import { mkdirSync } from "node:fs";
