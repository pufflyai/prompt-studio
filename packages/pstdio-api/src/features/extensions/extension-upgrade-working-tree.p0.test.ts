import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { legacyCatalogFingerprint } from "../../services/extension-upgrade-provider";
import { packagedExtensionCatalog } from "./extension-catalog";
import { prepareExtensionUpgradeBaseline, rememberExtensionUpgradeBaseline } from "./extension-upgrade-baseline";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";

test("upgrade detection sees ignored local additions and leaves dependency installation out of the comparison", () => {
  const path = mkdtempSync(join(tmpdir(), "pstdio-upgrade-tree-"));
  try {
    writeFileSync(join(path, ".pstdioignore"), "local.txt\n");
    writeFileSync(join(path, "extension.ts"), "export default {};\n");
    const baseline = fingerprintUpgradeWorkingTree(path);

    mkdirSync(join(path, "node_modules"));
    writeFileSync(join(path, "node_modules", "generated"), "dependency");
    expect(fingerprintUpgradeWorkingTree(path)).toBe(baseline);

    writeFileSync(join(path, "local.txt"), "local edits");
    expect(fingerprintUpgradeWorkingTree(path)).not.toBe(baseline);
    rmSync(join(path, "local.txt"));
    expect(fingerprintUpgradeWorkingTree(path)).toBe(baseline);

    if (process.platform !== "win32") {
      symlinkSync("extension.ts", join(path, "local-link.ts"), "file");
      expect(fingerprintUpgradeWorkingTree(path)).not.toBe(baseline);
    }

    mkdirSync(join(path, ".git"));
    expect(() => fingerprintUpgradeWorkingTree(path)).toThrow("Git history");
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("a rediscovered catalog installation requires an exact release fingerprint again at replacement", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-legacy-catalog-"));
  const path = join(home, "extensions", "pstdio-onboarding");
  const source = {
    install_name: "onboarding",
    extension_id: "pstdio.onboarding",
    source_kind: "local_path" as const,
    source_ref: null,
    source_path: path,
  };
  try {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), '{"name":"onboarding","version":"0.3.0"}');
    expect(legacyCatalogFingerprint(source, packagedExtensionCatalog, home)).toBeUndefined();
    rememberExtensionUpgradeBaseline(home, "original-release", path);
    const baseline = legacyCatalogFingerprint(source, packagedExtensionCatalog, home);
    expect(baseline).toBe(fingerprintUpgradeWorkingTree(path));
    expect(
      legacyCatalogFingerprint({ ...source, extension_id: "other.onboarding" }, packagedExtensionCatalog, home),
    ).toBeUndefined();
    const upgradeBase = { path, ref: null, rememberedFingerprint: baseline };
    expect(await prepareExtensionUpgradeBaseline(home, upgradeBase, home)).toBe(baseline);
    writeFileSync(join(path, "custom.ts"), "user edit");
    expect(legacyCatalogFingerprint(source, packagedExtensionCatalog, home)).toBeUndefined();
    await expect(prepareExtensionUpgradeBaseline(home, upgradeBase, home)).rejects.toMatchObject({
      name: "ExtensionUpgradeLocalEditsError",
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
