import { expect, test } from "bun:test";
import { recordSmokeHostDiagnostic } from "./smoke-observations";
import type { SmokeResult } from "./smoke-result";

test("a registration-ready event cannot erase a registration failure", () => {
  const result: SmokeResult = {
    host: { version: "test" },
    exitCode: 0,
    result: "passed",
    checks: [],
    coverage: { projectContext: "scratch", visited: [], unexercised: [], counts: {} },
    durations: {},
  };
  recordSmokeHostDiagnostic(
    result,
    { event: "registration-error", extensionId: "acme.notes", message: "Duplicate contribution" },
    "host-registration",
  );
  recordSmokeHostDiagnostic(result, { event: "registration-ready", projectId: "project" }, "host-registration");
  expect(result.exitCode).toBe(1);
  expect(result.checks).toMatchObject([
    { status: "failed", extensionId: "acme.notes", message: "Duplicate contribution" },
  ]);
  recordSmokeHostDiagnostic(
    result,
    { event: "registration-error", message: "Unknown host failure" },
    "host-registration",
  );
  expect(result.exitCode).toBe(3);
});
