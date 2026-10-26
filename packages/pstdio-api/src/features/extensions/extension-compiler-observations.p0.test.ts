import { expect, test } from "bun:test";
import { compilerResourceObservation } from "./extension-compiler-observations";

test("missing kernel compiler readings stay unavailable instead of becoming zero cost", () => {
  expect(compilerResourceObservation(undefined)).toEqual({ resourceObservation: "unavailable" });
  expect(compilerResourceObservation({ cpuTime: { total: 0 }, maxRSS: 0 })).toEqual({
    resourceObservation: "unavailable",
  });
  expect(compilerResourceObservation({ cpuTime: { total: 12_000 }, maxRSS: 1024 })).toEqual({
    cpuMicros: 12_000,
    peakRssBytes: 1024,
    resourceObservation: "kernel_exit_usage",
  });
});
