import { expect, test } from "bun:test";
import { assertCoreBinarySize } from "./core-binary-size";

test("enforces the 200 MB hard limit for core binaries", () => {
  expect(() => assertCoreBinarySize("core", 199_999_999)).not.toThrow();
  expect(() => assertCoreBinarySize("core", 200_000_000)).not.toThrow();
  expect(() => assertCoreBinarySize("core", 200_000_001)).toThrow("hard limit is 200 MB");
});
