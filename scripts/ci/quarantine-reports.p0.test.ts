import { expect, test } from "bun:test";
import { verifyQuarantineReport } from "./quarantine-reports";

const file = "packages/pstdio-api/src/features/automation/automation-runs.p1.test.ts";
const name = "automation run cancellation and credentials > cancels remote provisioning";

// Bun's JUnit report for one failing case, as written by `bun test --reporter=junit`.
const bunReport = (failure: string) => `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="1" assertions="1" failures="1" skipped="0" time="0.1">
  <testsuite name="${file}" file="${file}" tests="1" assertions="1" failures="1" skipped="0" time="0.1">
    <testsuite name="automation run cancellation and credentials" file="${file}" line="218" tests="1" failures="1">
      <testcase name="cancels remote provisioning" classname="automation run cancellation and credentials" time="0.1" file="${file}" line="250" assertions="1">
        <failure type="AssertionError" message="expect(received).toMatchObject(expected)">${failure}</failure>
      </testcase>
    </testsuite>
  </testsuite>
</testsuites>`;

test("a Bun quarantine failure counts as known only when it matches its registered signature", () => {
  const expected = [{ file, name, failureMessageIncludes: ["providerCancelCount"] }];
  const known = bunReport(
    "-       &quot;providerCancelCount&quot;: 1,&#10;+       &quot;providerCancelCount&quot;: 0,",
  );
  expect(verifyQuarantineReport(known, expected, process.cwd(), process.cwd())).toEqual({ executed: 1, failures: 1 });

  const other = bunReport("error: this test timed out after 30000ms.");
  expect(() => verifyQuarantineReport(other, expected, process.cwd(), process.cwd())).toThrow(
    "Unexpected quarantine failure",
  );
});
