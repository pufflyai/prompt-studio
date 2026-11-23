import { expect, test } from "bun:test";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createRecoveryChunkStore } from "./chunks";
import { moveLegacyRecoveryChunks } from "./legacy-project-cache";
import { removeProjectFolderRecovery } from "./project-paths";

test("offline cleanup recognizes only the legacy namespace with an authenticated project root", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-project-recovery-cache-"));
  try {
    const makeStore = async (projectId: string) => {
      const space = await createSyncSpace({
        projectId,
        spaceOwner: "account",
        keys: [{ generation: 1, secret: "A".repeat(43) }],
      });
      return createRecoveryChunkStore({ root: join(root, "chunks"), space });
    };
    const owned = await makeStore("evicted");
    const other = await makeStore("other-project");
    const bytes = new TextEncoder().encode("Saved recovery root");
    const ownedRoot = await owned.stage(bytes, "metadata");
    const otherRoot = await other.stage(bytes, "metadata");

    await moveLegacyRecoveryChunks(root, "evicted", [ownedRoot]);
    // A retry after the move can still remove the entire namespace through the scoped path.
    await moveLegacyRecoveryChunks(root, "evicted", [ownedRoot]);
    await removeProjectFolderRecovery(root, "evicted");
    await expectRejection(lstat(owned.directory)).toMatchObject({ code: "ENOENT" });
    expect(await other.read(otherRoot)).toEqual(bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
