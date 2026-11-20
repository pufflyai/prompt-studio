import assert from "node:assert/strict";
import { verifyBunQuarantineCases } from "./quarantine-reports";
import { matchesPlatform, quarantineRegistry } from "./test-quarantine";

const expected = quarantineRegistry.filter(
  (entry) => entry.runner === "project-upgrade" && matchesPlatform(entry, process.platform, process.arch),
);
assert.equal(expected.length, 1, "Expected one registered project upgrade quarantine case");

const reports = [
  ...new Bun.Glob("test-results/project-upgrades/run-*/active/quarantined-ticket-editor.json").scanSync(),
];
assert.equal(reports.length, expected.length, "Require one execution report for the project upgrade quarantine");
const reported = await Promise.all(reports.map((path) => Bun.file(path).json()));
const { failures } = verifyBunQuarantineCases(reported, expected);
if (failures) {
  console.warn("::warning::PS-1270 quarantined failure: ticket editor did not appear after an upgrade restart");
} else {
  console.log("The quarantined ticket editor check passed.");
}
