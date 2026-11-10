import { expect, test } from "bun:test";
import { assertCoreBinarySize } from "./core-binary-size";

test("enforces the 280 MB hard limit for core binaries", () => {
  expect(() => assertCoreBinarySize("core", 279_999_999)).not.toThrow();
  expect(() => assertCoreBinarySize("core", 280_000_000)).not.toThrow();
  expect(() => assertCoreBinarySize("core", 280_000_001)).toThrow("hard limit is 280 MB");
});
