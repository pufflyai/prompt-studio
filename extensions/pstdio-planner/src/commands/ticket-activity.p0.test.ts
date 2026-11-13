import { expect, test } from "bun:test";
import { createMemoryActivity, createMemoryStorage } from "@pstdio/sdk/testing";
import { seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTagOptionCommand, setTicketTagsCommand } from "./ticket-tags";

test("board tag edits and option removal record readable history", async () => {
  const storage = createMemoryStorage();
  const activity = createMemoryActivity();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { activity } });
  const ticket = await createTicketCommand.run(ctx, { title: "History" });
  const tags = await seedDefaultTags(storage);
  const tag = tags.find((tag) => tag.id === "default-priority")!;
  const option = tag.options[0]!;
  await setTicketTagsCommand.run(ctx, { rowId: ticket.id, tagIds: [option.id] });
  const resource = { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "ticket", id: ticket.id };
  expect((await activity.query({ resource })).items).toMatchObject([
    { kind: "change", changes: [{ field: "tags", label: "Tags", afterLabel: `${tag.name}: ${option.name}` }] },
  ]);
  await deleteTagOptionCommand.run(ctx, { tagId: tag.id, optionId: option.id });
  const entries = (await activity.query({ resource })).items;
  expect(entries).toHaveLength(2);
  expect(
    entries.some((entry) =>
      entry.changes?.some(
        (change) => change.beforeLabel === `${tag.name}: ${option.name}` && change.afterLabel === "None",
      ),
    ),
  ).toBe(true);
});
