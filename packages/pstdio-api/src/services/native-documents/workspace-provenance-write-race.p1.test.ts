import { expect, test } from "bun:test";
import { join } from "node:path";
import { createWorkspaceFileMount } from "../../features/extensions/command-environment/workspace-files";
import { artifactFilesFixture } from "../shared-files/artifact-files.fixture";
import { workspaceFileObservationKey } from "../shared-files/observed-file-mount";
import { withStorageObservation } from "../shared-files/storage-observation";
import { createNativeFileCopy } from "./file-copy";
import { withNativeFileWrite } from "./file-write-context";

test("workspace save rechecks outside bytes after awaiting native provenance preparation", async () => {
  const f = await artifactFilesFixture();
  const storage = f.deps.extensionStorageService;
  const file = join(f.root, "note.md"),
    documentKey = "5".repeat(64);
  const begin = storage.nativeFileProjections.begin;
  try {
    await Bun.write(file, "base");
    const text = storage.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.seed("base");
    const state = await text.exportUpdate();
    await storage.nativeRooms.create({
      owner: f.owner,
      documentKey,
      target: { fileRendererId: "example.notes.view.note", resource: undefined },
      state,
    });
    const projectionKey = workspaceFileObservationKey(f.root, "note.md");
    await createNativeFileCopy(storage, { owner: f.owner, documentKey, projectionKey }).observe("base", state);
    const mount = createWorkspaceFileMount(async () => f.root);
    const loaded = await withStorageObservation({}, () => mount.readText("note.md"));
    storage.nativeFileProjections.begin = async (input) => {
      await begin(input);
      // Deterministic external edit after the guard but during actual DB provenance preparation.
      await Bun.write(file, "OUTSIDE during provenance");
    };
    let rejected: unknown;
    try {
      await withStorageObservation(loaded.versions, () =>
        withNativeFileWrite({ storage, owner: f.owner, documentKey, projectionKey, state }, () =>
          mount.writeText("note.md", "own intended"),
        ),
      );
    } catch (error) {
      rejected = error;
    }
    const actual = await Bun.file(file).text();
    console.log("after staged provenance:", JSON.stringify(actual), "rejected:", String(rejected));
    expect(actual).toBe("OUTSIDE during provenance");
    expect(rejected).toBeInstanceOf(Error);
  } finally {
    storage.nativeFileProjections.begin = begin;
    await f.close();
  }
});
