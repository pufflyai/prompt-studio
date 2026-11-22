import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coreOwnerId, rememberResourceNumber, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync/records";
import * as Y from "yjs";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { captureDocumentFiles } from "../services/extension-storage/document-history.fixture";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb } from "./connection.pglite";

test("distinct retained inputs for one owner preserve both exact source graphs across admission and reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-input-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const project = await createProjectsDBService(connection.db).create({ name: "Repeated input" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const ownerId = await ensureStorageOwner(connection.db, owner);
    const expected = [];
    for (const floor of [70, 90]) {
      const documents = createDocumentStorageDBService(connection.db);
      await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
        const resource = {
          id: `original-${floor}`,
          extensionId: "example.items",
          kind: "item",
          prefix: "IT",
          value: floor - 1,
        };
        resourceNumbers(document).set(resource.id, resource);
        rememberResourceNumber(document, { ...resource, value: floor });
      });
      const source = (await captureDocumentFiles(connection.db)).find(
        (value) => value.row.owner_id === ownerId && value.row.key === resourceNumbersDocumentId,
      )!;
      expected.push(source.files);
      await documents.flushStatistics();
      await connection.close();
      connection = await createDb({ path });
    }
    const archivePath = `${path}-migration-exports`;
    const names = (await readdir(archivePath))
      .filter((name) => name.startsWith(`legacy-number-${ownerId}-`) && name.endsWith("-documents.jsonl"))
      .sort();
    expect(names).toHaveLength(2);
    const originals = await Promise.all(
      names.map(async (name) => JSON.parse((await readFile(join(archivePath, name), "utf8")).trim())),
    );
    expect(originals.map((row) => row.files)).toEqual(expect.arrayContaining(expected));
    const reconstructed = [];
    for (const index of names.keys()) {
      const document = new Y.Doc();
      try {
        const files = originals[index]!.files as { kind: string; sha256: string; data: string }[];
        const head = JSON.parse(
          Buffer.from(files.find((file) => file.kind === "head")!.data.slice(2), "hex").toString(),
        );
        const read = (kind: string, sha256: string) =>
          Buffer.from(files.find((file) => file.kind === kind && file.sha256 === sha256)!.data.slice(2), "hex");
        Y.applyUpdate(document, read("state", head.snapshot.sha256));
        for (const update of head.updates) Y.applyUpdate(document, read("update", update.sha256));
        reconstructed.push([...resourceNumbers(document).keys()]);
      } finally {
        document.destroy();
      }
    }
    expect(reconstructed.flat().sort()).toEqual(["original-70", "original-90"]);
    expect(originals.every((row) => JSON.stringify(row.source_owner) === JSON.stringify(owner))).toBe(true);
    const numbers = createExtensionResourceSequencesDBService(connection.db);
    expect(
      (await numbers.allocate({ projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" }))
        .shorthand,
    ).toBe("IT-91");
    await connection.close();
    connection = await createDb({ path });
    expect(
      (await readdir(archivePath))
        .filter((name) => name.startsWith(`legacy-number-${ownerId}-`) && name.endsWith("-documents.jsonl"))
        .sort(),
    ).toEqual(names);
    expect(await Promise.all(names.map((name) => readFile(join(archivePath, name), "utf8")))).toEqual(
      originals.map((row) => `${JSON.stringify(row)}\n`),
    );
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});
