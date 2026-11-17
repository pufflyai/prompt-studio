import { afterEach, test as baseTest, expect } from "bun:test";
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceRecoveryPolicy } from "./capture-source";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createProjectFolderPolicy, createRecoveryPolicy } from "./policy";
import { openRecoverySource } from "./source-posix";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const folder = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-policy-"));
  roots.push(root);
  return root;
};

const readRecoveryPolicy = async (root: string) => {
  const source = await openRecoverySource(root);
  try {
    return await sourceRecoveryPolicy(source.root);
  } finally {
    source.close();
  }
};

baseTest("the starter policy excludes dependency directories at any depth and retains private project files", () => {
  const policy = createRecoveryPolicy("node_modules/\n");
  expect(policy.classify("node_modules/", true)).toEqual({ included: false, rule: "node_modules/" });
  expect(policy.classify("tools/node_modules/", true).included).toBe(false);
  for (const path of [".env", ".git/config", ".pstdio/extensions/tool.ts", "node_modules.txt"])
    expect(policy.classify(path).included).toBe(true);
});

baseTest("the last matching rule wins, excluded parents stay excluded and the root policy always remains", () => {
  const policy = createRecoveryPolicy("*\n!src/\nsrc/*\n!src/keep.txt\n\\#literal\n\\!literal\n");
  expect(policy.classify(".pstignore").included).toBe(true);
  expect(policy.classify("src/", true).included).toBe(true);
  expect(policy.classify("src/keep.txt").included).toBe(true);
  expect(policy.classify("src/other.txt")).toEqual({ included: false, rule: "src/*" });
  expect(policy.classify("other/keep.txt").included).toBe(false);
  expect(policy.classify("#literal").included).toBe(false);
  expect(policy.classify("!literal").included).toBe(false);
});

baseTest("root anchors, directory rules, globstars and nested ordinary policy files follow one root policy", () => {
  const policy = createRecoveryPolicy("/cache/\n**/*.tmp\n");
  expect(policy.classify("cache/", true).included).toBe(false);
  expect(policy.classify("nested/cache/", true).included).toBe(true);
  expect(policy.classify("nested/deep/file.tmp").included).toBe(false);
  expect(policy.classify("nested/.pstignore").included).toBe(true);
  expect(createRecoveryPolicy(null).classify("node_modules/", true).included).toBe(true);
  expect(createRecoveryPolicy("").classify(".env").included).toBe(true);
});

baseTest("a project folder never includes extension storage, whatever its own rules say", () => {
  for (const text of [null, "", "*\n!.pstdio/\n!.pstdio/**\n", "!.pstdio/extension-storage/\n"]) {
    const policy = createProjectFolderPolicy(text);
    expect(policy.text).toBe(text);
    expect(policy.classify(".pstdio/extension-storage", true)).toEqual({
      included: false,
      rule: "/.pstdio/extension-storage/",
    });
  }
  const policy = createProjectFolderPolicy("");
  for (const path of [".pstdio/extensions/tool/extension.ts", ".pstdio/config.json", "src/extension-storage/notes"])
    expect(policy.classify(path).included).toBe(true);
  // Roots outside the project folder, such as external Git administration, keep their own policy.
  expect(createRecoveryPolicy(null).classify(".pstdio/extension-storage", true).included).toBe(true);
});

test("a folder without .pstignore has no policy and nothing creates one; an emptied policy includes everything", async () => {
  const root = await folder();
  await writeFile(join(root, ".gitignore"), "node_modules/\n");
  expect((await readRecoveryPolicy(root)).text).toBeNull();
  expect(await readFile(join(root, ".pstignore")).catch((error) => error.code)).toBe("ENOENT");
  await writeFile(join(root, ".pstignore"), "");
  expect((await readRecoveryPolicy(root)).text).toBe("");
  await unlink(join(root, ".pstignore"));
  expect((await readRecoveryPolicy(root)).text).toBeNull();
});

test("a .pstignore with a byte-order mark keeps it in the recorded text but not in its rules", async () => {
  const root = await folder();
  await writeFile(join(root, ".pstignore"), "\uFEFFdist/\n");
  const policy = await readRecoveryPolicy(root);
  expect(policy.text).toBe("\uFEFFdist/\n");
  expect(policy.classify("dist/", true).included).toBe(false);
});

baseTest("an invalid or linked policy blocks capture instead of broadening coverage", async () => {
  const root = await folder();
  await writeFile(join(root, ".pstignore"), new Uint8Array([0xff]));
  await expect(readRecoveryPolicy(root)).rejects.toThrow();
  await unlink(join(root, ".pstignore"));
  await writeFile(join(root, "rules"), "private/\n");
  await symlink("rules", join(root, ".pstignore"));
  await expect(readRecoveryPolicy(root)).rejects.toThrow();
  expect(() => createRecoveryPolicy("private\u0000data")).toThrow();
});
