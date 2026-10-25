import { expect, test } from "bun:test";
import { createApiTestPlan } from "./api-test-plan";

const files = ["src/a.test.ts", "src/b.test.ts", "src/c.test.ts", "src/d.test.ts"];
test("explicit selected API paths are exact, normalized and checked against discovery", () => {
  expect(createApiTestPlan(files, { files: ["./src/b.test.ts", "src\\a.test.ts"] }).files).toEqual(files.slice(0, 2));
  expect(() => createApiTestPlan(files, { files: ["src/missing.test.ts"] })).toThrow("Unknown");
  expect(() => createApiTestPlan(files, { files: [] })).toThrow("empty");
  expect(() => createApiTestPlan(files, { files: [files[0]!, files[0]!] })).toThrow("Duplicate");
});
test("balanced shards retain every selected file exactly once and keep longest work first", () => {
  const timings = { "src/a.test.ts": 8, "src/b.test.ts": 7, "src/c.test.ts": 2, "src/d.test.ts": 1 };
  const first = createApiTestPlan(files, { shard: "1/2", timings });
  const second = createApiTestPlan(files, { shard: "2/2", timings });
  expect(first.files).toEqual([files[0]!, files[3]!]);
  expect(second.files).toEqual([files[1]!, files[2]!]);
  expect([...first.files, ...second.files].sort()).toEqual(files);
  expect(createApiTestPlan(files).files).toEqual(files);
  expect(() => createApiTestPlan(files, { shard: "0/2" })).toThrow("shard");
  expect(() => createApiTestPlan(files, { timings: { "src/a.test.ts": -2 } })).toThrow("duration");
});
