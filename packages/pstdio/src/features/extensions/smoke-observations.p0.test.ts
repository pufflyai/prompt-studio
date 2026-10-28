import { expect, test } from "bun:test";
import { recordSmokeHostDiagnostic, summarizeSmokeBrowserLog } from "./smoke-observations";
import type { SmokeResult } from "./smoke-result";

test("registration diagnostics keep warnings and failed requests when successful responses follow", () => {
  const messages = [
    "Registration warning",
    "Request failed: http://localhost/v1/extensions: net::ERR_CONNECTION_RESET",
    "HTTP 500: http://localhost/v1/extensions",
    ...Array.from({ length: 25 }, (_, index) => `HTTP 200: http://localhost/assets/chunk-${index}.js`),
  ];
  const lines = messages.map((message) => JSON.stringify({ phase: "host-registration", message }));
  expect(summarizeSmokeBrowserLog(`${lines.join("\n")}\n`)).toEqual(lines.slice(0, 3));
});

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
