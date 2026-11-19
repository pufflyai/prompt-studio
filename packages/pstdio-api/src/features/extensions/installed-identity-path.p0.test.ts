import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installedIdentityPath } from "./installed-identity-path";

test("an instance upgrade selects its recorded directory when both Planner names exist", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-identity-"));
  try {
    for (const name of ["planner", "pstdio-planner"]) {
      const dir = join(root, name);
      mkdirSync(dir);
      writeFileSync(join(dir, "extension.ts"), "export default {};");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          publisher: "pstdio",
          name,
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: "^0.5.0" },
        }),
      );
    }
    for (const name of ["planner", "pstdio-planner"]) {
      const registered = join(root, name);
      expect(installedIdentityPath(root, "planner", "pstdio.planner", registered)).toBe(registered);
    }
    expect(() => installedIdentityPath(root, "planner", "pstdio.planner")).toThrow(/Conflicting/);
    expect(() => installedIdentityPath(root, "planner", "pstdio.planner", join(root, "..", "planner"))).toThrow(
      /Conflicting/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
