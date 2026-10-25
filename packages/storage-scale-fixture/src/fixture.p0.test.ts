import { expect, test } from "bun:test";
import { createRow, owners, pageRows, workload } from "./fixture";

test("rich workload freezes ten owners, distributed selection and a real second page", () => {
  const spec = workload("rich");
  expect(owners(spec)).toHaveLength(10);
  expect(owners(spec).reduce((sum, owner) => sum + owner.rows, 0)).toBe(100_000);
  const first = pageRows(spec, 0, "focus", 0);
  expect(first).toHaveLength(100);
  expect(new Set(first.map((row) => row.ordinal % 100))).toEqual(new Set([37]));
  const a = pageRows(spec, 0, "pages", 0);
  const b = pageRows(spec, 0, "pages", 1);
  expect(a).toHaveLength(100);
  expect(b).toHaveLength(100);
  expect(new Set([...a, ...b].map((row) => row.id)).size).toBe(200);
});

test("rich byte distribution, nested values, tags, multiline text and history stay fixed", () => {
  const sizes: number[] = [];
  let tail = 0;
  for (let index = 0; index < 10_000; index++) {
    const row = createRow("rich", 0, index, 3);
    const bytes = Buffer.byteLength(JSON.stringify(row));
    sizes.push(bytes);
    if (bytes >= 16_384) tail++;
    expect(row.history).toBe(3);
    expect(row.tags.length).toBeGreaterThan(0);
    expect("content" in row && row.content).toContain("\n");
    expect(row.details).toBeObject();
  }
  expect(sizes.sort((a, b) => a - b)[5_000]).toBeGreaterThanOrEqual(2_048);
  expect(tail).toBe(500);
  expect(createRow("rich", 2, 44, 3)).toEqual(createRow("rich", 2, 44, 3));
  expect(createRow("rich", 2, 44, 0)).not.toEqual(createRow("rich", 2, 44, 3));
});

test("small workload keeps one 100,000-row owner and nine enabled 100-row owners", () => {
  const spec = workload("small");
  expect(owners(spec).map((owner) => owner.rows)).toEqual([100_000, ...Array(9).fill(100)]);
  const sizes = Array.from({ length: 1_000 }, (_, index) =>
    Buffer.byteLength(JSON.stringify(createRow("small", 0, index, 3))),
  ).sort((a, b) => a - b);
  expect(sizes[0]).toBeGreaterThanOrEqual(256);
  expect(sizes[500]).toBeGreaterThanOrEqual(512);
  expect(sizes.at(-1)).toBeLessThanOrEqual(1_024);
  expect(createRow("small", 0, 25, 3)).not.toHaveProperty("content");
  expect(pageRows(spec, 0, "focus", 0)).toHaveLength(100);
});
