import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { folderRecoveryError } from "./operations";
import { publishRecoveryStaging } from "./publish-posix";
import { checkRecoveryDestination } from "./restore";

test.skipIf(nativeRecoverySupported)(
  "unsupported native recovery reports its limitation and preserves source and destination data",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "recovery-unsupported-"));
    try {
      const source = join(root, "source");
      const staging = join(root, "staging");
      const destination = join(root, "existing");
      for (const folder of [source, staging, destination]) await mkdir(folder);
      await writeFile(join(source, "draft"), "source work");
      await writeFile(join(staging, "draft"), "staged work");
      await writeFile(join(destination, "draft"), "destination work");
      const space = await createSyncSpace({
        projectId: "project",
        spaceOwner: "owner",
        keys: [{ generation: 1, secret: "A".repeat(43) }],
      });
      const chunks = await createRecoveryChunkStore({ root: join(root, "chunks"), space });
      const error = await captureRecoveryFolder({ root: source, chunks }).catch((error) => error);
      expect(error).toMatchObject({ code: "ENOTSUP" });
      expect(folderRecoveryError(error)).toMatchObject({ code: "unsupported", path: null });
      expect(await readdir(source)).toEqual(["draft"]);
      expect(await readFile(join(source, "draft"), "utf8")).toBe("source work");
      expect(await readdir(chunks.directory)).toEqual([]);
      const { dev, ino } = await stat(root, { bigint: true });
      await expect(
        publishRecoveryStaging({ parent: root, identity: { dev, ino }, from: "staging", to: "existing" }),
      ).rejects.toMatchObject({ code: "ENOTSUP" });
      await expect(checkRecoveryDestination(destination)).rejects.toMatchObject({ code: "unsupported" });
      await expect(checkRecoveryDestination(join(root, "new"))).rejects.toMatchObject({ code: "unsupported" });
      expect(await readFile(join(destination, "draft"), "utf8")).toBe("destination work");
      expect(await readFile(join(staging, "draft"), "utf8")).toBe("staged work");
      expect((await readdir(root)).sort()).toEqual(["chunks", "existing", "source", "staging"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
