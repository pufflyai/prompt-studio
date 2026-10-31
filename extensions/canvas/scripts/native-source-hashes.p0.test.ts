import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashNativeBuildSources } from "./native-source-hashes";

test("native source hashes use the checkout-relative key through a linked checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-source-hashes-"));
  try {
    const checkout = join(root, "checkout");
    const linked = join(root, "linked");
    await mkdir(join(checkout, "src"), { recursive: true });
    await writeFile(join(checkout, "src/component.tsx"), "component source");
    await symlink(checkout, linked, "junction");
    expect(await hashNativeBuildSources(linked, [join(checkout, "src/component.tsx")])).toEqual({
      "src/component.tsx": createHash("sha256").update("component source").digest("hex"),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native source hashes normalize module IDs and exclude dependencies, generated modules and outside files", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-source-hashes-"));
  try {
    const checkout = join(root, "checkout");
    const paths = [
      "src/component.tsx",
      "node_modules/dependency/index.js",
      "src/__test-tmp__/fixture.ts",
      "extensions/canvas/src/catalog/generated/native-manifest.json",
      "extensions/canvas/src/catalog/generated/frame-bundle.ts",
    ];
    for (const file of paths) {
      await mkdir(join(checkout, file, ".."), { recursive: true });
      await writeFile(join(checkout, file), file);
    }
    const outside = join(root, "outside.ts");
    await writeFile(outside, "outside");
    const hashes = await hashNativeBuildSources(checkout, [
      ...paths.map((file) => join(checkout, file)),
      `${join(checkout, "src/component.tsx").replaceAll("/", "\\")}?commonjs-proxy`,
      join(checkout, "missing.ts"),
      "\0virtual-module",
      outside,
    ]);
    expect(Object.keys(hashes)).toEqual(["src/component.tsx"]);
    expect(hashes["src/component.tsx"]).toBe(createHash("sha256").update(paths[0]!).digest("hex"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
