import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createDb } from "../db/connection.pglite";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createProjectsDBService } from "./projects/projects";

const fixture = async () => {
  const connection = await createDb({ path: ":memory:" });
  const project = await createProjectsDBService(connection.db).create({ name: "Prompt Studio" });
  const service = createExtensionResourceSequencesDBService(connection.db);
  const owner = { workbenchId: project.id, extensionId: "pstdio" };
  const input = { projectId: project.id, extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
  return { ...connection, service, owner, input };
};

test("offline number collisions merge durably with aliases and notify after commit", async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    for (let i = 0; i < 30; i++) await first.service.allocate(first.input);
    const exportState = (f: typeof first) =>
      f.service.documentStore.transaction(f.owner, async ({ document }) => Y.encodeStateAsUpdate(document));
    const receive = (f: typeof first, update: Uint8Array) =>
      f.service.documentStore.transaction(f.owner, async ({ document }) => {
        Y.applyUpdate(document, update);
      });
    await receive(second, await exportState(first));
    const a = await first.service.allocate(first.input);
    const b = await second.service.allocate(second.input);
    expect(a.shorthand).toBe("PS-31");
    expect(b.shorthand).toBe("PS-31");
    const events: unknown[] = [];
    first.service.watch((event) => events.push(event));
    const updates = await Promise.all([exportState(first), exportState(second)]);
    await receive(first, updates[1]);
    await receive(second, updates[0]);
    const [winner, loser] = [a, b].sort((x, y) => (x.id < y.id ? -1 : 1));
    for (const f of [first, second]) {
      expect(await f.service.identity({ ...f.input, id: winner!.id })).toEqual({
        id: winner!.id,
        kind: "ticket",
        shorthand: "PS-31",
        aliases: [],
      });
      expect(await f.service.identity({ ...f.input, id: loser!.id })).toEqual({
        id: loser!.id,
        kind: "ticket",
        shorthand: "PS-32",
        aliases: ["PS-31"],
      });
      expect((await f.service.findByShorthand({ ...f.input, shorthand: "PS-31" })).map((r) => r.id)).toEqual([
        winner!.id,
        loser!.id,
      ]);
      expect((await f.service.allocate(f.input)).shorthand).toBe("PS-33");
    }
    expect(events).toContainEqual(
      expect.objectContaining({
        previousShorthand: "PS-31",
        shorthand: "PS-32",
        resource: expect.objectContaining({ id: loser!.id }),
      }),
    );
    const reopened = createExtensionResourceSequencesDBService(first.db);
    expect((await reopened.identity({ ...first.input, id: loser!.id }))?.shorthand).toBe("PS-32");
    expect(await reopened.identity({ ...first.input, kind: "report", id: loser!.id })).toBeNull();
  } finally {
    await first.close();
    await second.close();
  }
});

test("one shorthand can resolve to several aliases and failed merges publish no event", async () => {
  const f = await fixture();
  try {
    const first = await f.service.allocate(f.input);
    await f.service.documentStore.transaction(f.owner, async ({ document }) => {
      const numbers = document.getMap<import("pstdio-sync").NumberedResource>("resource-numbers");
      for (const id of ["x", "y"]) numbers.set(id, { ...numbers.get(first.id)!, id });
    });
    const matches = await f.service.findByShorthand({ ...f.input, shorthand: "PS-1" });
    expect(matches.map((resource) => resource.id)).toEqual([first.id, "x", "y"]);
    expect(matches.slice(1).map((resource) => resource.aliases)).toEqual([["PS-1"], ["PS-1"]]);
    const events: unknown[] = [];
    f.service.watch((event) => events.push(event));
    await expect(
      f.service.documentStore.transaction(f.owner, async ({ document }) => {
        document.getMap("resource-numbers").clear();
        throw new Error("aborted merge");
      }),
    ).rejects.toThrow("aborted merge");
    expect(events).toEqual([]);
    expect(await f.service.findByShorthand({ ...f.input, shorthand: "PS-1" })).toEqual(matches);
  } finally {
    await f.close();
  }
});
