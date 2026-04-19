import { describe, expect, test } from "bun:test";
import { parseVars } from "./parse-vars";

describe("parseVars", () => {
  test("returns undefined for empty input", () => {
    expect(parseVars()).toBeUndefined();
    expect(parseVars([])).toBeUndefined();
  });

  test("parses key=value pairs", () => {
    expect(parseVars(["ticket=PS-7", "output=error log"])).toEqual({
      ticket: "PS-7",
      output: "error log",
    });
  });

  test("handles values containing = signs", () => {
    expect(parseVars(["expr=a=b"])).toEqual({ expr: "a=b" });
  });

  test("throws on missing = separator", () => {
    expect(() => parseVars(["bad"])).toThrow('Invalid --var format: "bad"');
  });
});
