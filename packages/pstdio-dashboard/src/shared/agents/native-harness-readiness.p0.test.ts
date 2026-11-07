import { expect, test } from "bun:test";
import { nativeHarnessReady } from "./native-harness-readiness";

test("native chat waits for harness and account discovery, sign-in and a required model", () => {
  const installed = { availability: { type: "INSTALLED" as const }, supportsModels: true };
  const ready = {
    agentsChecked: true,
    agent: installed,
    authenticationChecked: true,
    status: "signed_in" as const,
    model: "saved",
    authenticating: false,
  };
  expect(nativeHarnessReady(ready)).toBe(true);
  expect(nativeHarnessReady({ ...ready, agentsChecked: false })).toBe(false);
  expect(nativeHarnessReady({ ...ready, agent: undefined })).toBe(false);
  expect(nativeHarnessReady({ ...ready, authenticationChecked: false })).toBe(false);
  expect(nativeHarnessReady({ ...ready, status: "signed_out" })).toBe(false);
  expect(nativeHarnessReady({ ...ready, model: undefined })).toBe(false);
  expect(nativeHarnessReady({ ...ready, authenticating: true })).toBe(false);
  expect(nativeHarnessReady({ ...ready, status: "not_required" })).toBe(true);
  expect(nativeHarnessReady({ ...ready, agent: { ...installed, supportsModels: false }, model: undefined })).toBe(true);
});

test("an online remote owner follows device availability without requiring a local harness login", () => {
  expect(
    nativeHarnessReady({ agentsChecked: false, authenticationChecked: false, authenticating: false, remote: true }),
  ).toBe(true);
});
