import { afterEach, test as baseTest, expect } from "bun:test";
import { mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceRecoveryPolicy } from "./capture-source";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createRecoveryPolicy } from "./policy";
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

const readRecoveryPolicy = async (root: string, firstEnrollment = false) => {
  const staging = await folder();
  const source = await openRecoverySource(root);
  try {
    return await sourceRecoveryPolicy(source.root, firstEnrollment, staging);
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

test("only first enrollment seeds a missing policy; existing, emptied and deliberately absent policies survive", async () => {
  const root = await folder();
  expect((await readRecoveryPolicy(root, true)).text).toBe("node_modules/\n");
  expect((await stat(join(root, ".pstignore"))).mode & 0o777).toBe(0o600);
  await writeFile(join(root, ".pstignore"), "");
  expect((await readRecoveryPolicy(root, true)).text).toBe("");
  await unlink(join(root, ".pstignore"));
  expect((await readRecoveryPolicy(root)).text).toBeNull();
  expect(await readFile(join(root, ".pstignore")).catch((error) => error.code)).toBe("ENOENT");
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

test("an existing policy does not require staging or permission to create a replacement", async () => {
  const root = await folder();
  const blockedStage = join(root, "not-a-directory");
  await writeFile(blockedStage, "existing bytes");
  await writeFile(join(root, ".pstignore"), "private/\n");
  const source = await openRecoverySource(root);
  try {
    expect((await sourceRecoveryPolicy(source.root, true, blockedStage)).text).toBe("private/\n");
  } finally {
    source.close();
  }
});
