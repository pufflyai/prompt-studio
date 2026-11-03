import { expect, test } from "bun:test";

test("JSON values preserve special property names and reject non-JSON values", async () => {
  const { jsonSchema } = await import("./wire");
  const value = JSON.parse('{"__proto__":{"retained":true},"constructor":"retained"}');
  expect(jsonSchema.parse(value)).toEqual(value);
  expect(Object.hasOwn(jsonSchema.parse(value) as object, "__proto__")).toBe(true);
  expect(jsonSchema.safeParse({ missing: undefined }).success).toBe(false);
  expect(jsonSchema.safeParse({ number: Infinity }).success).toBe(false);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(jsonSchema.safeParse(cyclic).success).toBe(false);
});
