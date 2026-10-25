import { expect, test } from "bun:test";
import { normalizePageParams, resolvePageParams, validatePageParamDefinitions } from "./page-params";

test("page declarations reserve existing host selectors and validate defaults", () => {
  for (const name of ["resource", "section", "document", "line", "_host", "Uppercase", "a".repeat(65)]) {
    expect(() => validatePageParamDefinitions({ [name]: { type: "string" } })).toThrow("page_param_reserved");
  }
  expect(() => validatePageParamDefinitions({ range: { type: "string", values: ["short"], default: "long" } })).toThrow(
    "page_param_invalid",
  );
  expect(() => normalizePageParams({ range: { type: "string", values: ["short"] } }, { range: "long" })).toThrow(
    "page_param_invalid",
  );
});

test("params normalize in declaration order and fill declared defaults", () => {
  const definitions = {
    range: { type: "string" as const, default: "short" },
    live: { type: "boolean" as const, default: false },
  };
  expect(normalizePageParams(definitions, { live: true, range: "long" })).toEqual(
    normalizePageParams(definitions, { range: "long", live: true }),
  );
  expect(JSON.stringify(normalizePageParams(definitions, { live: true, range: "long" }))).toBe(
    JSON.stringify(normalizePageParams(definitions, { range: "long", live: true })),
  );
  expect(resolvePageParams(definitions)).toEqual({ range: "short", live: false });
  expect(normalizePageParams(definitions, { range: "short", live: false })).toBeUndefined();
});
