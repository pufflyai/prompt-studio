import { afterAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { editor } from "pstdio-notes/src/pages";
import { saveTicketContent } from "pstdio-planner/src/commands/save-ticket-content";
import { captureCheckpoint, storageRecordId } from "pstdio-sync";
import { sealCheckpoint } from "pstdio-sync-contracts";
import { createCoveredFixture } from "pstdio-sync-contracts/conformance";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { acceptedHandlerState, handlerPorts } from "./checkpoint-handlers.fixture";
import { storageObserver, withStorageObservation } from "./storage-observation";

const fixture = await createCoveredFixture();
afterAll(() => fixture.close());

for (const consumer of ["notes", "planner"] as const)
  for (const stale of [false, true])
    test(`unchanged ${consumer} save joins its document checkpoint with stale base ${stale}`, async () => {
      const f = await artifactFilesFixture();
      try {
        await f.mount().writeText("note/content.md", "old body");
        await f.mount().writeText("note/title.txt", "Preserved title");
        const initial = await f.storage.readState();
        const environmentId = initial.journal[0].mutation.environmentId;
        const ticketId = storageRecordId(["project", f.owner.workbenchId, "collection", "tickets"], "ticket");
        const ticket = await f.storage.records.read(ticketId);
        await f.storage.records.commit({
          operationId: "seed-ticket",
          edits: [
            {
              recordId: ticketId,
              expectedRevision: ticket.revision,
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
        const before = await withStorageObservation({}, async () => {
          await f.storage.records.read(f.recordId("documents/note/content.md"));
          await f.storage.records.read(
            storageRecordId(["project", f.owner.workbenchId, "collection", "tickets"], "ticket"),
          );
        });
        if (stale) {
          if (consumer === "notes") await f.replace("documents/note/content.md", "concurrent body");
          else {
            const remote = await f.storage.records.read(ticketId);
            await f.storage.records.commit({
              operationId: "remote-ticket",
              edits: [
                {
                  recordId: ticketId,
                  expectedRevision: remote.revision,
                  replace: {
                    value: {
                      id: "ticket",
                      shorthand: "PS-1",
                      title: "Remote title",
                      content: "remote",
                      files: [],
                      updatedAt: "remote",
                    },
                    sortOrder: null,
                  },
                },
              ],
            });
          }
        }
        const state = await acceptedHandlerState(f);
        const publishedCount = (await f.storage.readState()).journal.length;
        const relay = await fixture.scenario();
        await relay.seed(state.accepted!.records);
        const result = await withStorageObservation(before.versions, () =>
          captureCheckpoint(
            state,
            environmentId,
            async (store) => {
              const ports = handlerPorts(f, store, environmentId);
              const document = await ports.raw.records.read("document");
              await ports.raw.records.commit({
                operationId: "document-delta",
                edits: [
                  {
                    recordId: "document",
                    expectedRevision: document.revision,
                    shared: [{ kind: "text.insert", index: 0, text: "# Renamed\nbody" }],
                  },
                ],
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
            },
            storageObserver,
          ),
        );
        const captured = result.value;
        expect(captured.changes).toHaveLength(consumer === "notes" ? 3 : 2);
        expect(captured.parents).toEqual([]);
        expect((await f.storage.readState()).journal).toHaveLength(publishedCount);
        expect(await readFile(f.pathFor("documents/note/content.md"), "utf8")).toBe("old body");
        const template = await relay.group("a", "unused");
        const group = await sealCheckpoint({ ...template, changes: captured.changes });
        for (const change of group.changes)
          if (change.asset?.next) {
            const bytes = new Uint8Array(
              await new Response(await f.assets.read(f.owner, change.asset.next)).arrayBuffer(),
            );
            await relay.upload(change.asset.next, bytes);
          }
        await expect(relay.submit(group, "after-commit")).rejects.toThrow("commit");
        const receipt = await relay.submit(group);
        expect(receipt.status).toBe(stale ? "conflict" : "accepted");
        expect(await relay.submit(group)).toEqual(receipt);
        const accepted = (await relay.snapshot()).records;
        const acceptedTicket = accepted[ticketId].value as { value: { title: string } };
        if (consumer === "planner") expect(acceptedTicket.value.title).toBe(stale ? "Remote title" : "Renamed");
        else expect(acceptedTicket.value.title).toBe("Old title");
        if (!stale && consumer === "notes") {
          const content = accepted[f.recordId("documents/note/content.md")].asset!;
          expect(new TextDecoder().decode((await relay.readAsset(content))!)).toContain('title: "Preserved title"');
          expect(accepted[f.recordId("documents/note/title.txt")].deleted).toBe(true);
          expect(captured.value).toHaveLength(1);
        }
        if (stale) expect(accepted.document).toBeUndefined();
      } finally {
        await f.close();
      }
    });
