import { expect, test } from "bun:test";
import { editor } from "pstdio-notes/src/pages";
import { saveTicketContent } from "pstdio-planner/src/commands/save-ticket-content";
import { storageRecordId } from "pstdio-sync";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { handlerPorts } from "./checkpoint-handlers.fixture";

for (const consumer of ["notes", "planner"] as const)
  test(`unchanged ${consumer} save stages its files and records in one document update`, async () => {
    const f = await artifactFilesFixture();
    try {
      await f.mount().writeText("note/content.md", "old body");
      await f.mount().writeText("note/title.txt", "Preserved title");
      const ticketId = storageRecordId(["project", f.owner.workbenchId, "collection", "tickets"], "ticket");
      await f.storage.records.commit({
        operationId: "seed-ticket",
        edits: [
          {
            recordId: ticketId,
            replace: {
              value: {
                id: "ticket",
                shorthand: "PS-1",
                title: "Old title",
                content: "old",
                files: [],
                updatedAt: "before",
              },
              sortOrder: null,
            },
          },
        ],
      });
      const before = await f.storage.exportUpdate();
      const captured = await f.storage.capture(async (store) => {
        const ports = handlerPorts(f, store);
        await ports.raw.records.commit({
          operationId: "document-delta",
          edits: [{ recordId: "document", shared: [{ kind: "text.insert", index: 0, text: "# Renamed\nbody" }] }],
        });
        if (consumer === "notes")
          await editor.body.save?.(
            { artifacts: { mount: () => ports.mount }, events: { emit: ports.emit } } as never,
            {
              renderer: { rendererId: "notes", resource: { type: "note", id: "note" } },
              content: "# Renamed\nbody",
            } as never,
          );
        else
          await saveTicketContent({ storage: ports.storage, events: { emit: ports.emit } } as never, {
            id: "ticket",
            content: "# Renamed\nbody",
          });
        return ports.events;
      });
      expect(await f.storage.exportUpdate()).toEqual(before);
      await f.storage.applyUpdate(captured.update);
      expect((await f.storage.records.read("document")).shared).toEqual({ kind: "text", value: "# Renamed\nbody" });
      const ticket = (await f.storage.records.read(ticketId)).value as { value: { title: string } };
      expect(ticket.value.title).toBe(consumer === "planner" ? "Renamed" : "Old title");
      if (consumer === "notes") {
        expect(await f.mount().readText("note/content.md")).toContain('title: "Preserved title"');
        expect((await f.storage.records.read(f.recordId("documents/note/title.txt"))).deleted).toBe(true);
        expect(captured.value).toHaveLength(1);
      }
    } finally {
      await f.close();
    }
  });
