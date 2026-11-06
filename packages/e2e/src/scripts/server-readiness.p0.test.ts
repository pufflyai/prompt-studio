import { expect, test } from "bun:test";
import { fixtureServerReady } from "./server-readiness";

const app = JSON.stringify({ event: "runtime.startup.phase", phase: "app_ready", elapsedMs: 300 });
const registration = (state: string) =>
  JSON.stringify({ event: "runtime.setup.phase", phase: "default_extensions.register", span_id: "setup", state });

test("fixture readiness waits for the app and registration in either completion order", () => {
  expect(fixtureServerReady.test(app)).toBe(false);
  expect(fixtureServerReady.test(registration("completed"))).toBe(false);
  expect(fixtureServerReady.test(`${app}\n${registration("completed")}`)).toBe(true);
  expect(fixtureServerReady.test(`${registration("completed")}\n${app}`)).toBe(true);
});

test("starting or failing registration cannot admit functional tests", () => {
  for (const state of ["started", "failed"])
    expect(fixtureServerReady.test(`${app}\n${registration(state)}`)).toBe(false);
});
