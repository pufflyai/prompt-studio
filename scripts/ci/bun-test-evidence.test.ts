import { expect, test } from "bun:test";
import { junitCases } from "./bun-test-evidence";

test("JUnit case evidence keeps parameter instances, escaped titles and skipped outcomes distinct", () => {
  const cases = junitCases(`<testsuites tests="3"><testsuite>
    <testcase file="a.test.ts" line="2" classname="inputs" name="a &amp; b" time="0.001" />
    <testcase file="a.test.ts" line="2" classname="inputs" name="a &amp; b" time="0"><skipped /></testcase>
    <testcase file="a.test.ts" line="3" name="validation"><failure /></testcase>
  </testsuite></testsuites>`);
  expect(cases.map((entry) => entry.outcome)).toEqual(["success", "skipped", "failure"]);
  expect(cases[0]?.title).toBe("inputs > a & b");
  expect(cases[0]?.durationMs).toBe(1);
  expect(new Set(cases.map((entry) => entry.id)).size).toBe(3);
  expect(() => junitCases('<testsuites tests="2"><testcase name="only one" /></testsuites>')).toThrow("Incomplete");
  expect(() => junitCases("")).toThrow("Missing");
});
