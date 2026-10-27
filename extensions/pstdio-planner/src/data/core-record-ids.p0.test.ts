import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createTicketStatus } from "./status-operations";
import { createTagOption, createTicketTag } from "./tag-operations";

test("Planner records and nested options use core IDs", async () => {
  const storage = createMemoryStorage();
  const allocate = storage.ids.create;
  const allocated: string[] = [];
  storage.ids.create = () => {
    const id = allocate();
    allocated.push(id);
    return id;
  };
  const ctx = makeCommandContext({ storage, params: {} });
  const input = { storage, resources: ctx.resources };
  const status = await createTicketStatus({ ...input, name: "Review" });
  const tag = await createTicketTag({ ...input, name: "Area" });
  const option = await createTagOption({ ...input, tagId: tag.id, name: "Cloud" });
  expect(allocated).toEqual([status.id, tag.id, option.id]);
});
