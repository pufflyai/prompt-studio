import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createProjectWork, ProjectRemovalInProgress } from "../project-work";
import { selected, textEditingFixture } from "./text-editing.test-fixture";

test("grant a record field from one verified source observation and reject incomplete content", async () => {
  let reloads = 0;
  const projectWork = createProjectWork();
  const f = await textEditingFixture({
    projectWork,
    beforeDocumentLoad: async () => {
      reloads++;
    },
  });
  try {
    await writeFile(
      join(f.root, "extension.ts"),
      `export default {
      textSources: [{ id: "body", ref: {kind:"text-source", id:"body"}, params: {},
        resolve: async ctx => ({source:{kind:"record",recordId:"note",field:"/body"},
          content: await ctx.workspaceFiles.readText("provided.txt"),editable:true}), project: async () => {} }],
      views: [{id:"document",ref:{kind:"view",id:"document"},title:"Note",body:{kind:"file",
        load:async()=>({textDocument:{sourceId:"body",params:{}},fileName:"note.md"})}}]
    }`,
    );
    f.deps.extensionRuntimeCatalog.invalidate({ projectId: "project-1", reason: "source_changed" });
    const owner = { workbenchId: "project-1", extensionId: "example.context" };
    const records = (await f.deps.extensionStorageService.open({ owner })).records;
    await records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { body: "complete note" } }] });
    const connect = () => f.text.connect("project-1", { kind: "agent", target: selected });
    await writeFile(join(f.root, "provided.txt"), "partial");
    await expectRejection(connect()).toThrow("complete source bytes");
    await writeFile(join(f.root, "provided.txt"), "complete note");
    expect(await connect()).toHaveProperty("token");
    expect(reloads).toBe(0);
    projectWork.freeze(owner.workbenchId);
    await expectRejection(connect()).toBeInstanceOf(ProjectRemovalInProgress);
  } finally {
    await f.cleanup();
  }
});
