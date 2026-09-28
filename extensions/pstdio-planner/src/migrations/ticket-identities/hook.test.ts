import { expect, test } from "bun:test";
import { projectEvents } from "@pstdio/sdk/extensions";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import extension from "../../../extension";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket, ticketsCollection } from "../../data/collections";
import { projectOpenedHook } from "./hook";

test("opening an upgraded project migrates existing tickets without creating a ticket", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  await putTicket(storage, {
    id: "legacy",
    shorthand: "T-9",
    title: "Existing",
    content: "# Existing",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  expect(extension.hooks).toContain(projectOpenedHook);
  const ctx = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });
  await projectOpenedHook.run(
    { ...ctx, eventId: projectEvents.opened.id, deliveryId: "opening" },
    {
      projectId: ctx.projectId,
    },
  );
  expect((await ticketsCollection(storage).get("legacy"))?.shorthand).toBe("T-1");
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
  await projectOpenedHook.run(
    { ...ctx, eventId: projectEvents.opened.id, deliveryId: "reopening" },
    {
      projectId: ctx.projectId,
    },
  );
  expect((await ticketsCollection(storage).get("legacy"))?.shorthand).toBe("T-1");
});
