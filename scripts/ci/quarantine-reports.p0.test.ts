import { expect, test } from "bun:test";
import { verifyBunQuarantineCases, verifyPlaywrightQuarantineReport } from "./quarantine-reports";

const expected = [
  { file: "packages/example/a.test.ts", name: "first" },
  { file: "packages/example/b.test.ts", name: "second" },
];
const result = (file: string, title: string, outcome = "success") => ({ file, title, outcome });

test("Bun quarantine requires each registered file and title exactly once", () => {
  expect(
    verifyBunQuarantineCases(
      [result(expected[0]!.file, "first"), result(expected[1]!.file, "suite > second", "failure")],
      expected,
    ),
  ).toEqual({ executed: 2, failures: 1 });
  for (const entries of [
    [result(expected[0]!.file, "first"), result(expected[0]!.file, "first")],
    [result(expected[0]!.file, "first"), result(expected[1]!.file, "renamed")],
    [result(expected[0]!.file, "first"), result(expected[1]!.file, "second", "skipped")],
    [result(expected[0]!.file, "first")],
  ])
    expect(() => verifyBunQuarantineCases(entries, expected)).toThrow();
});

test("Playwright quarantine rejects duplicate, wrong-file, skipped and retried execution", () => {
  const wanted = expected.map((e) => ({ ...e, file: e.file.replace(".test.ts", ".spec.ts") }));
  const spec = (index: number, results = [{ status: "passed" }]) => ({
    title: wanted[index]!.name,
    file: index === 0 ? "a.spec.ts" : "b.spec.ts",
    tests: [{ results }],
  });
  const report = (specs: ReturnType<typeof spec>[]) => ({
    config: { rootDir: "/repo/packages/example" },
    suites: [{ specs }],
  });
  expect(verifyPlaywrightQuarantineReport(report([spec(0), spec(1, [{ status: "failed" }])]), wanted, "/repo")).toEqual(
    { executed: 2, failures: 1 },
  );
  for (const specs of [
    [spec(0), spec(0)],
    [spec(0), spec(1, [{ status: "skipped" }])],
    [spec(0), spec(1, [{ status: "failed" }, { status: "passed" }])],
    [spec(0)],
  ])
    expect(() => verifyPlaywrightQuarantineReport(report(specs), wanted, "/repo")).toThrow();
  expect(() =>
    verifyPlaywrightQuarantineReport({ ...report([spec(0), spec(1)]), errors: ["setup failed"] }, wanted, "/repo"),
  ).toThrow();
});

test("an old report from the same commit cannot certify a new attempt", async () => {
  const { verifyQuarantineAttempt } = await import("./quarantine-reports");
  const identity = { sourceSha: "source", policyDigest: "policy", platform: "linux", arch: "x64" };
  const attempt = { ...identity, token: "new" };
  expect(() => verifyQuarantineAttempt(attempt, identity, "new")).not.toThrow();
  expect(() => verifyQuarantineAttempt(attempt, identity, "old")).toThrow();
  expect(() => verifyQuarantineAttempt({ ...attempt, sourceSha: "old" }, identity, "new")).toThrow();
});
