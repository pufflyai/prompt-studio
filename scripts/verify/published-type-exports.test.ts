import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareEntryExports } from "./published-type-exports";

const comparePackage = (published: string) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-type-exports-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true }, include: ["src"] }));
    writeFileSync(
      join(root, "src/index.ts"),
      "interface Input { value: string }\nexport interface Result { ok: boolean }\nexport const read = (input: Input): Result => ({ ok: input.value.length > 0 });\n",
    );
    writeFileSync(join(root, "dist/index.d.ts"), published);
    const [entry] = compareEntryExports(join(root, "tsconfig.json"), [
      { source: join(root, "src/index.ts"), published: join(root, "dist/index.d.ts") },
    ]);
    return { missing: entry!.missing, extra: entry!.extra };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("accepts published types that export exactly the source entry's members", () => {
  expect(
    comparePackage(
      "interface Input { value: string }\nexport interface Result { ok: boolean }\nexport declare const read: (input: Input) => Result;\nexport {};\n",
    ),
  ).toEqual({ missing: [], extra: [] });
});

test("reports public members that the published types drop", () => {
  expect(comparePackage("export declare const read: (input: { value: string }) => { ok: boolean };\n")).toEqual({
    missing: ["Result"],
    extra: [],
  });
});

test("reports internal declarations that the published types expose", () => {
  expect(
    comparePackage(
      "interface Input { value: string }\nexport interface Result { ok: boolean }\nexport declare const read: (input: Input) => Result;\n",
    ),
  ).toEqual({ missing: [], extra: ["Input"] });
});
