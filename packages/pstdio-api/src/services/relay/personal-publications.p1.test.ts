import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createSessionLogFiles } from "../personal-history/log-files";
import { createPersonalHistoryStore } from "../personal-history/store";
import { createPersonalPublications } from "./personal-publications";

test("a newer head and terminal proof arriving during a flush remain pending until saved", async () => {
  const root = await mkdtemp(join(tmpdir(), "publication-race-"));
  const history = createPersonalHistoryStore({
    projectId: "project",
    accountId: "account",
    managerOrigin: "http://manager.example",
    files: createSessionLogFiles(root),
    documents: { open: () => createMemoryDocumentStore() },
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await history.patchRecords("sessions", { ownerId: "account", id: "device", name: "Laptop" }, [{ id: "session" }]);
  const write = history.writeHeads;
  history.writeHeads = async (heads, proofs) => {
    entered.resolve();
    await release.promise;
    return write(heads, proofs);
  };
  const publications = createPersonalPublications({ history, published: () => {}, wake: () => {} });
  try {
    publications.published("session", 1);
    const first = publications.flush(true, false);
    await entered.promise;
    publications.published("session", 2, "terminal-version");
    release.resolve();
    await first;
    expect(publications.pending()).toBe(true);
    expect(await history.readHeads()).toEqual(new Map([["session", 1]]));
    await publications.flush(false, false);
    expect(publications.pending()).toBe(false);
    expect(await history.readHeads()).toEqual(new Map([["session", 2]]));
    expect(await history.readPublication("session")).toEqual({ head: 2, version: "terminal-version" });
  } finally {
    release.resolve();
    publications.close();
    await rm(root, { recursive: true, force: true });
  }
});
