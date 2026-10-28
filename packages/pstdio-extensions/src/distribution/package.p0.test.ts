import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageMetadata, packExtension, readExtensionPackage, unpackExtension } from "./package";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const fixture = async (version = "0.45.1") => {
  const root = await mkdtemp(join(tmpdir(), "extension-package-"));
  roots.push(root);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "notes",
      publisher: "alice",
      version,
      main: "extension.ts",
      engines: { pstdio: "^0.2.0" },
      files: ["extension.ts", "assets"],
    }),
  );
  await writeFile(join(root, "extension.ts"), "export default {};");
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets", "icon.svg"), "<svg/>");
  await writeFile(join(root, "private.env"), "SECRET");
  return root;
};

test.each([
  "0.46.0-nightly.20261028030226",
  "1.0.0-rc.1+build.42",
  "1.0.0+build.001",
])("packs and unpacks the exact semantic version %s", async (version) => {
  const packed = await packExtension(await fixture(version));
  expect(packed.filename).toBe(`alice.notes-${version}.tgz`);
  const target = await mkdtemp(join(tmpdir(), "unpacked-extension-version-"));
  roots.push(target);
  const manifest = await unpackExtension(packed.bytes, target, {
    id: "alice.notes",
    version,
    sha256: packed.sha256,
  });
  expect(manifest.version).toBe(version);
  expect(JSON.parse(await readFile(join(target, "package.json"), "utf8")).version).toBe(version);
});

test.each([
  "01.2.3",
  "1.2",
  "1.2.3-01",
  "1.2.3-nightly..1",
  "1.2.3-",
  "1.2.3+",
  "1.2.3+build..1",
  "1.2.3/path",
  "1.2.3\n",
])("refuses malformed package version %s", (version) => {
  expect(() =>
    packageMetadata({
      name: "notes",
      publisher: "alice",
      version,
      main: "extension.ts",
      engines: { pstdio: "^0.2.0" },
    }),
  ).toThrow("Invalid extension package");
});

test("packs the declared runtime files under the full identity and round trips them", async () => {
  const root = await fixture();
  const packed = await packExtension(root);
  expect(packed.filename).toBe("alice.notes-0.45.1.tgz");
  const contents = await readExtensionPackage(packed.bytes);
  expect(contents.manifest.id).toBe("alice.notes");
  expect([...contents.files.keys()].sort()).toEqual(["assets/icon.svg", "extension.ts", "package.json"]);
  const target = await mkdtemp(join(tmpdir(), "unpacked-extension-"));
  roots.push(target);
  await unpackExtension(packed.bytes, target, { id: "alice.notes", version: "0.45.1", sha256: packed.sha256 });
  expect(await readFile(join(target, "assets", "icon.svg"), "utf8")).toBe("<svg/>");
  expect((await packExtension(root)).sha256).toBe(packed.sha256);
});

test("refuses modified packages and mismatched identities before writing files", async () => {
  const packed = await packExtension(await fixture());
  const target = await mkdtemp(join(tmpdir(), "refused-extension-"));
  roots.push(target);
  await expect(
    unpackExtension(packed.bytes, target, {
      id: "bob.notes",
      version: "0.45.1",
      sha256: packed.sha256,
    }),
  ).rejects.toThrow("identity");
  await expect(
    unpackExtension(packed.bytes, target, {
      id: "alice.notes",
      version: "0.45.1",
      sha256: "0".repeat(64),
    }),
  ).rejects.toThrow("SHA-256");
});

test("unchanged extension contents keep their package hash across clock and filesystem timestamp changes", async () => {
  const root = await fixture();
  const first = await packExtension(root);
  await Bun.sleep(1100);
  await utimes(join(root, "extension.ts"), new Date(0), new Date(0));
  const second = await packExtension(root);
  expect(second.sha256).toBe(first.sha256);
  expect(second.bytes).toEqual(first.bytes);
});

test("refuses unsafe archive paths", async () => {
  const bytes = new Uint8Array(
    await new Bun.Archive(
      {
        "../outside.ts": "export default {};",
      },
      { compress: "gzip" },
    ).bytes(),
  );
  await expect(readExtensionPackage(bytes)).rejects.toThrow();
});

test("uses a portable package filename for an accepted Windows device publisher", async () => {
  const root = await fixture();
  const path = join(root, "package.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify({ ...manifest, publisher: "con" }));
  const packed = await packExtension(root);
  expect(packed.manifest.id).toBe("con.notes");
  expect(packed.filename).toBe("_con.notes-0.45.1.tgz");
});
