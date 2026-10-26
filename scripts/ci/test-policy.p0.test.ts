import { expect, test } from "bun:test";
import { evaluateCiGate, priorityForJob } from "./test-policy";

test("P1 blocks immediately while independent P0 diagnostics are still running", () => {
  expect(
    evaluateCiGate(
      [
        { id: "package_checks", count: 1 },
        { id: "database_tests", count: 2 },
      ],
      [
        { name: "package_checks (1/1)", status: "in_progress", conclusion: null },
        { name: "database_tests (api 1/2)", status: "completed", conclusion: "failure" },
        { name: "database_tests (api 2/2)", status: "in_progress", conclusion: null },
      ],
      true,
    ).outcome,
  ).toBe("failure");
});

test("non-P1 failures wait for every selected independent result", () => {
  const plan = [
    { id: "package_checks", count: 1 },
    { id: "windows_database_tests", count: 2 },
  ];
  const results = [
    { name: "package_checks (1/1)", status: "completed", conclusion: "failure" },
    { name: "windows_database_tests (api 1/2)", status: "completed", conclusion: "failure" },
    { name: "windows_database_tests (api 2/2)", status: "in_progress", conclusion: null },
  ];
  expect(evaluateCiGate(plan, results, true).outcome).toBe("pending");
  results[2] = { ...results[2], status: "completed", conclusion: "failure" };
  const gate = evaluateCiGate(plan, results, true);
  expect(gate.outcome).toBe("failure");
  expect(gate.failures).toHaveLength(3);
});

test("production waits for all tiers even after an early P1 failure", () => {
  expect(
    evaluateCiGate(
      [
        { id: "e2e", count: 1 },
        { id: "windows_database_tests", count: 1 },
      ],
      [
        { name: "e2e", status: "completed", conclusion: "failure" },
        { name: "windows_database_tests", status: "in_progress", conclusion: null },
      ],
      false,
    ).outcome,
  ).toBe("pending");
});

test("missing, skipped, and duplicated selected results cannot certify a candidate", () => {
  const plan = [{ id: "database_tests", count: 2 }];
  const result = { name: "database_tests (1)", status: "completed", conclusion: "success" };
  expect(evaluateCiGate(plan, [result], false, true).outcome).toBe("failure");
  expect(evaluateCiGate(plan, [result, result], false, true).outcome).toBe("failure");
  expect(
    evaluateCiGate(
      [{ id: "package_checks", count: 1 }],
      [{ name: "package_checks (1/1)", status: "completed", conclusion: "skipped" }],
      false,
    ).outcome,
  ).toBe("failure");
});

test("a complete success requires all matrix rows and unknown functional jobs remain P1", () => {
  expect(priorityForJob("future_contract")).toBe("P1");
  expect(priorityForJob("windows_test_and_build")).toBe("P2");
  expect(priorityForJob("functional / package_checks (1/4)")).toBe("P0");
  expect(priorityForJob("functional / static_checks")).toBe("P0");
  expect(priorityForJob("functional / harness_cli_support / harness-codex (minimum)")).toBe("P2");
  expect(
    evaluateCiGate(
      [{ id: "package_checks", count: 1 }],
      [{ name: "package_checks (1/1)", status: "completed", conclusion: "success" }],
      true,
    ).outcome,
  ).toBe("success");
});

test("another distinct matrix row cannot replace a missing selected row", () => {
  const plan = [{ id: "e2e", count: 2, names: ["e2e (1)", "e2e (2)"] }];
  const jobs = ["e2e (1)", "e2e (3)"].map((name) => ({ name, status: "completed", conclusion: "success" }));
  expect(evaluateCiGate(plan, jobs, false, true).outcome).toBe("failure");
});

test("production can finish without waiting on its downstream renamed gate", () => {
  const jobs = [
    { name: "functional / package_checks (1/1)", status: "completed", conclusion: "success" },
    { name: "functional / validation_results", status: "in_progress", conclusion: null },
    { name: "functional / production_ci_passed", status: "queued", conclusion: null },
  ];
  expect(evaluateCiGate([{ id: "package_checks", count: 1 }], jobs, false).outcome).toBe("success");
});
