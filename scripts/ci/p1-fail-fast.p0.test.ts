import { expect, test } from "bun:test";
import { failedP1Job } from "./p1-fail-fast";

test("peer fail-fast observes only failed P1 jobs", () => {
  const completed = (name: string) => ({ name, status: "completed", conclusion: "failure" });
  expect(
    failedP1Job([completed("package_checks (1/4)"), completed("windows_test_and_build (unit-1)")]),
  ).toBeUndefined();
  expect(failedP1Job([completed("build_clients (win32-x64)")])).toBeUndefined();
  expect(failedP1Job([completed("e2e (3)")])?.name).toBe("e2e (3)");
  expect(failedP1Job([{ name: "e2e (1)", status: "completed", conclusion: "cancelled" }])).toBeUndefined();
});
