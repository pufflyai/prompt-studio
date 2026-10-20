import { expect, test } from "bun:test";
import { artifactFilesFixture } from "../../../services/shared-files/artifact-files.fixture";
import { createArtifactsApi } from "./artifacts";

test("ordinary artifact writes enter the durable shared journal with complete asset bytes", async () => {
  const f = await artifactFilesFixture();
  try {
    const api = createArtifactsApi(
      async () => f.root,
      {
        extensionId: f.owner.extensionId,
        name: "example-documents",
        projectId: f.owner.workbenchId,
        onWrite: () => {},
        artifactMounts: [
          {
            id: "example.documents.artifact-mount.documents",
            localId: "documents",
            extensionId: f.owner.extensionId,
            name: "example-documents",
            relativePath: "documents",
            sourcePath: "fixture",
            fullPath: "documents",
            label: "Documents",
            watch: false,
            changedEventId: "changed",
          },
        ],
      },
      f.deps,
    );
    await api.mount("documents").writeText("note.md", "Saved through the ordinary artifact API");
    const record = (await f.storage.records.list())[0]!;
    expect(record.asset).toBeDefined();
    expect(await new Response(await f.assets.read(f.owner, record.asset!)).text()).toBe(
      "Saved through the ordinary artifact API",
    );
  } finally {
    await f.close();
  }
});
