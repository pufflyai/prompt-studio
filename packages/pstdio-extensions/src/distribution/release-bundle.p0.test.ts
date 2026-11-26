import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packExtensionReleaseBundle, unpackExtensionReleaseBundle } from "./release-bundle";

test("release runtime artifacts bind executable bytes and webviews to an exact source", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-release-bundle-"));
  const encode = (value: string) => new TextEncoder().encode(value);
  const id = "pstdio.example";
  const version = "1.2.3";
  const sha256 = "a".repeat(64);
  try {
    const { bytes, descriptor } = await packExtensionReleaseBundle(
      { extensionId: id, version, sourceSha256: sha256, webviews: ["pstdio.example.view.main"] },
      { "runtime.mjs": encode("export default {};"), "webviews/0/module.js": encode("export default () => null;") },
    );
    const metadata = await unpackExtensionReleaseBundle(bytes, descriptor, { id, version, sha256 }, root);
    expect(metadata.webviews).toEqual(["pstdio.example.view.main"]);
    expect(await readFile(join(root, "runtime.mjs"), "utf8")).toBe("export default {};");
    expect(await readFile(join(root, "webviews", "0", "module.js"), "utf8")).toBe("export default () => null;");

    const wrongSource = unpackExtensionReleaseBundle(bytes, descriptor, { id, version, sha256: "b".repeat(64) }, root);
    await expect(wrongSource).rejects.toThrow("different release identity");
    const modified = bytes.slice();
    modified[modified.length - 1] ^= 1;
    await expect(unpackExtensionReleaseBundle(modified, descriptor, { id, version, sha256 }, root)).rejects.toThrow(
      "checksum or size mismatch",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
