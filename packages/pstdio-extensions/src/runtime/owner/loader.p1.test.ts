import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { disposeExtensionOwners, loadExtensionPackageForHost, stopExtensionOwners } from "./loader";

test("Stop during source identity preparation prevents the pending load from starting an owner", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-stop-preparing-owner-"));
  const saved = process.env.PSTDIO_EXTENSION_PROCESS_OWNERS;
  const savedAdmission = process.env.PSTDIO_EXTENSION_RESOURCE_ADMISSION;
  process.env.PSTDIO_EXTENSION_PROCESS_OWNERS = "1";
  process.env.PSTDIO_EXTENSION_RESOURCE_ADMISSION = "0";
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "stopped",
      version: "1.0.0",
      publisher: "test",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "extension.ts"), "export default {};");
  try {
    const loading = loadExtensionPackageForHost({ path: root }, []);
    const result = loading.catch((error) => error);
    await stopExtensionOwners(root);
    expect(await result).toMatchObject({ code: "extension_owner_stopped" });
    await expect(loadExtensionPackageForHost({ path: root }, [])).rejects.toMatchObject({
      code: "extension_owner_stopped",
    });
  } finally {
    await disposeExtensionOwners();
    if (saved === undefined) delete process.env.PSTDIO_EXTENSION_PROCESS_OWNERS;
    else process.env.PSTDIO_EXTENSION_PROCESS_OWNERS = saved;
    if (savedAdmission === undefined) delete process.env.PSTDIO_EXTENSION_RESOURCE_ADMISSION;
    else process.env.PSTDIO_EXTENSION_RESOURCE_ADMISSION = savedAdmission;
    rmSync(root, { recursive: true, force: true });
  }
});
