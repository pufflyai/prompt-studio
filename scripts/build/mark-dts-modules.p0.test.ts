import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { markDtsModules } from "./mark-dts-modules";

const exportedNames = (file: string) => {
  const program = ts.createProgram([file], { noEmit: true, module: ts.ModuleKind.ESNext });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  return moduleSymbol ? checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.name) : [];
};

test("keeps declarations that a bundled type file does not export private", () => {
  const dist = mkdtempSync(join(tmpdir(), "pstdio-dts-modules-"));
  try {
    const file = join(dist, "entry.d.ts");
    writeFileSync(file, "interface Input { value: string }\nexport declare const read: (input: Input) => string;\n");

    markDtsModules(dist);

    expect(exportedNames(file)).toEqual(["read"]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
