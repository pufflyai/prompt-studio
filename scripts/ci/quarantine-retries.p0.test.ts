import { expect, test } from "bun:test";
import { assertNoQuarantineRetries } from "./quarantine-retries";

test("quarantine refuses CLI and per-test retries, including local option aliases", () => {
  for (const args of [["--retry=1"], ["--retry", "1"], ["--rerun-each=2"]])
    expect(() => assertNoQuarantineRetries("", args)).toThrow();
  for (const source of [
    'import {test} from "bun:test";test("case",{retry:1},()=>{});',
    'import {test as check} from "bun:test";const options={retry:1};check("case",()=>{},options);',
    'import {test} from "bun:test";const native=process.platform==="darwin"?test:test.skip;native("case",{retry:1},()=>{});',
  ])
    expect(() => assertNoQuarantineRetries(source, [])).toThrow();
  expect(() =>
    assertNoQuarantineRetries(
      'import {test} from "bun:test";test("case",()=>{const product={retry:2};},{timeout:10000});',
      [],
    ),
  ).not.toThrow();
});
