import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadExtensionSource } from "./upload-source";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
test("uploads confined source links as usable files", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-linked-upload-"));
  roots.push(root);
  writeFileSync(join(root, "real.ts"), "export default {};");
  symlinkSync("real.ts", join(root, "linked.ts"));
  const linked = uploadExtensionSource(root)
    .getAll("files")
    .find((file) => (file as File).name === "linked.ts");
  expect(linked).toBeDefined();
  expect(await (linked as File).text()).toBe("export default {};");
});
test("uploads source and version history without dependencies or ignored files", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-upload-"));
  roots.push(root);
  mkdirSync(join(root, "node_modules"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(join(root, "extension.ts"), "export default {};");
  writeFileSync(join(root, ".gitignore"), "ignored.txt\n");
  writeFileSync(join(root, "ignored.txt"), "excluded");
  writeFileSync(join(root, "node_modules/dependency.txt"), "excluded");
  writeFileSync(join(root, ".git/config"), "history");
  const upload = uploadExtensionSource(root, { installName: "custom", force: true, development: true });
  expect(upload.get("installName")).toBe("custom");
  expect(upload.get("force")).toBe("true");
  expect(upload.get("development")).toBe("true");
  expect(
    upload
      .getAll("files")
      .map((file) => (file as File).name)
      .sort(),
  ).toEqual([".git/config", ".gitignore", "extension.ts", "package.json"]);
});
