import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const previewChangeset = `---
"@pstdio/sdk": patch
"@pstdio/ui": patch
---

Preview the public SDK and UI packages.
`;

export const versionPackagePreview = async (root: string) => {
  writeFileSync(join(root, ".changeset", "package-preview.md"), previewChangeset);
  const result = Bun.spawnSync(
    [
      process.execPath,
      Bun.resolveSync("@changesets/cli/bin.js", import.meta.dir),
      "version",
      "--snapshot",
      "preview",
      "--snapshot-prerelease-template",
      "{tag}.sha-{commit}",
    ],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode) throw new Error(`Package preview versioning failed (${result.exitCode})`);
  const sdk = JSON.parse(readFileSync(join(root, "packages/sdk/package.json"), "utf8"));
  const ui = JSON.parse(readFileSync(join(root, "packages/ui/package.json"), "utf8"));
  if (sdk.version !== ui.version) throw new Error("SDK/UI preview versions differ");
  return sdk.version as string;
};

if (import.meta.main) console.log(await versionPackagePreview(process.cwd()));
