import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionInstallFailure } from "./extension-install-failure";
import { ExtensionAlreadyInstalledError } from "./install-extension-source";

test("an incomplete installed folder still reports a replaceable conflict", async () => {
  const target = mkdtempSync(join(tmpdir(), "extension-conflict-"));
  try {
    const response = await extensionInstallFailure(new ExtensionAlreadyInstalledError(target));
    expect(response?.status).toBe(409);
    expect(response?.body).toMatchObject({ code: "extension_already_installed" });
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
