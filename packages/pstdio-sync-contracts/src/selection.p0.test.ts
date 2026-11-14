import { expect, test } from "bun:test";
import { resolveSelectedValues } from "./selection";

test("selection keeps base order and independently changed scalar/options", () => {
  expect(resolveSelectedValues(["b", "a"])).toEqual(["b", "a"]);
  expect(
    resolveSelectedValues(["a"], {
      type: "single",
      value: "b",
      options: { a: true, c: true },
      replacedOptions: { a: true },
    }),
  ).toEqual(["b", "c"]);
  expect(
    resolveSelectedValues(["a", "b"], {
      type: "multi",
      options: { a: false, c: true },
      value: "d",
      replacedValue: "b",
    }),
  ).toEqual(["b", "c", "d"]);
  expect(
    resolveSelectedValues(["b"], { type: "multi", options: { b: false }, value: "b", replacedValue: "b" }),
  ).toEqual([]);
});

test("concurrent option order is deterministic for numeric, reserved and Unicode keys", () => {
  const options = Object.fromEntries(["2", "10", "__proto__", "É\u0000", "constructor"].map((id) => [id, true]));
  const reversed = Object.fromEntries(Object.entries(options).reverse());
  const expected = ["10", "2", "__proto__", "constructor", "É\u0000"];
  expect(resolveSelectedValues([], { type: "multi", options })).toEqual(expected);
  expect(resolveSelectedValues([], { type: "multi", options: reversed })).toEqual(expected);
});
