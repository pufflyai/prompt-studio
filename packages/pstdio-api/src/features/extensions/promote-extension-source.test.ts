import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promotePreparedSource } from "./promote-extension-source";

test("keeps installed dependency links readable after their folder moves", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-"));
  try {
    const prepared = join(root, "staging/tool");
    const installed = join(root, "extensions/tool");
    const provider = join(root, "provider");
    mkdirSync(join(prepared, "vendor/demo"), { recursive: true });
    mkdirSync(join(prepared, "node_modules"));
    mkdirSync(join(prepared, "node_modules/.bin"));
    mkdirSync(join(root, "extensions"));
    mkdirSync(provider);
    writeFileSync(join(prepared, "vendor/demo/index.ts"), "export default 1;");
    writeFileSync(join(provider, "index.ts"), "export default 2;");
    const modules = join(prepared, "node_modules");
    for (const name of ["demo", "alias"]) writeFileSync(join(modules, name), "");
    const [first, last] = readdirSync(modules).filter((name) => name !== ".bin");
    for (const name of [first, last]) unlinkSync(join(modules, name!));
    // Create the chain before its destination exists so Bun retains both links.
    symlinkSync(join(modules, last!), join(modules, first!), "junction");
    symlinkSync(join(modules, last!, "index.ts"), join(modules, ".bin/demo"), "file");
    symlinkSync(join(prepared, "vendor/demo"), join(modules, last!), "junction");
    symlinkSync(provider, join(prepared, "node_modules/provider"), "junction");

    promotePreparedSource(prepared, installed, false, false);
    rmSync(join(root, "staging"), { recursive: true });

    expect(readFileSync(join(installed, "node_modules/demo/index.ts"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/alias/index.ts"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/.bin/demo"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/provider/index.ts"), "utf8")).toBe("export default 2;");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
