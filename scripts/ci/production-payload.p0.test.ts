import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertProductionPayload, describeProductionPayload } from "./production-payload";

test("a consumer rejects changed bytes even when metadata still names the expected artifact", async () => {
  const root = mkdtempSync(join(tmpdir(), "production-payload-"));
  const path = join(root, "release.tar.gz");
  writeFileSync(path, "original");
  const identity = await describeProductionPayload(path);
  await expect(assertProductionPayload(identity)).resolves.toBeUndefined();
  writeFileSync(path, "changed");
  await expect(assertProductionPayload(identity)).rejects.toThrow("payload digest");
});
