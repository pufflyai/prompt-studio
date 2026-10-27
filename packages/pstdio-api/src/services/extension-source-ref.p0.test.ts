import { expect, test } from "bun:test";
import type { BundledExtensionSources } from "pstdio-extensions/distribution";
import { resolveExtensionReleaseCommit } from "./extension-source-ref";

test("resolves nightly refs to the bundled source commit without Git", async () => {
  const url = "https://example.com/nightly-extensions";
  const releaseRef = "a".repeat(40);
  const manifest: BundledExtensionSources = {
    ref: releaseRef,
    commit: "b".repeat(40),
    sources: [
      { url, path: "extensions/demo", installName: "demo", id: "test.demo", version: "1.0.0", sha256: "c".repeat(64) },
    ],
  };
  const file = new File([JSON.stringify(manifest)], "extension-sources/manifest.json");
  const files = Bun.embeddedFiles as Blob[];
  files.unshift(file);
  const run = async () => {
    throw new Error("Resolving bundled or full-commit refs must not invoke Git");
  };
  try {
    expect(await resolveExtensionReleaseCommit(url, releaseRef, run)).toBe(manifest.commit);
    expect(await resolveExtensionReleaseCommit("https://example.com/other", releaseRef, run)).toBe(releaseRef);
    expect(await resolveExtensionReleaseCommit(url, "D".repeat(40), run)).toBe("d".repeat(40));
  } finally {
    files.splice(files.indexOf(file), 1);
  }
});
