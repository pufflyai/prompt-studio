import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTag, tagsCollection } from "../data/collections";
import { putTicket, ticketsCollection } from "../data/ticket-context.fixture";
import type { StoredTag, Ticket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { setTicketAttributeCommand } from "./set-ticket-attribute";
import { applyTicketTagDraftCommand, setTicketTagsCommand, updateTicketTagCommand } from "./ticket-tags";
import { updateTicketCommand } from "./update-ticket";

const option = (id: string, sortOrder: number) => ({
  id,
  name: id,
  color: "gray",
  sortOrder,
  icon: null,
  description: null,
});

const track: StoredTag = {
  id: "track",
  name: "Track",
  type: "multi_select",
  sortOrder: 50,
  options: [option("product", 0), option("platform", 1)],
};
const area: StoredTag = { id: "area", name: "Area", type: "multi_select", sortOrder: 51, options: [option("ui", 0)] };

const ticket = (shorthand: string, tagIds: string[], overrides: Partial<Ticket> = {}): Ticket => ({
  id: `id-${shorthand}`,
  shorthand,
  title: shorthand,
  content: `# ${shorthand}`,
  statusId: null,
  tagIds,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const setup = async () => {
  const storage = createMemoryStorage();
  await putTag(storage, track);
  await putTag(storage, area);
  await putTicket(storage, ticket("T-1", ["product", "platform", "ui"]));
  await putTicket(storage, ticket("T-2", ["product", "platform"], { archived: true }));
  await putTicket(storage, ticket("T-3", ["platform", "product"], { draft: true }));
  await putTicket(storage, ticket("T-4", ["platform"]));
  const run = <T extends { run: (...args: never[]) => unknown }>(command: T, params: Record<string, unknown>) =>
    (command.run as (...args: unknown[]) => Promise<unknown>)(...makeCommandArgs({ storage, params }));
  const tagIds = async () =>
    Object.fromEntries((await ticketsCollection(storage).list()).map((stored) => [stored.shorthand, stored.tagIds]));
  return { run, storage, tagIds };
};

describe("changing a property to single-select", () => {
  test.each([
    ["the public update command", updateTicketTagCommand],
    ["the settings draft", applyTicketTagDraftCommand],
  ])("names every conflicting ticket and changes nothing through %s", async (_path, command) => {
    const { run, storage, tagIds } = await setup();
    const before = await tagIds();

    const change = run(command, { tagId: "track", type: "single_select" });

    await expect(change).rejects.toThrow(/T-1, T-2, T-3/);
    await expect(change).rejects.not.toThrow(/T-4/);
    expect((await tagsCollection(storage).get("track"))?.type).toBe("multi_select");
    expect(await tagIds()).toEqual(before);
  });

  test("succeeds after each conflict is resolved and keeps every other assignment", async () => {
    const { run, storage, tagIds } = await setup();
    for (const [rowId, value] of [
      ["id-T-1", "product"],
      ["id-T-2", "platform"],
      ["id-T-3", "product"],
    ]) {
      await run(setTicketAttributeCommand, { rowId, attributeId: "track", value });
    }

    await run(updateTicketTagCommand, { tagId: "track", type: "single_select" });

    expect(await tagsCollection(storage).get("track")).toEqual({ ...track, type: "single_select" });
    expect(await tagIds()).toEqual({
      "T-1": ["ui", "product"],
      "T-2": ["platform"],
      "T-3": ["product"],
      "T-4": ["platform"],
    });
    const stored = await ticketsCollection(storage).list();
    expect(stored.map(({ shorthand, archived, content }) => [shorthand, archived, content])).toEqual([
      ["T-1", false, "# T-1"],
      ["T-2", true, "# T-2"],
      ["T-3", false, "# T-3"],
      ["T-4", false, "# T-4"],
    ]);
  });
});

describe("writing a single-select property", () => {
  const singleSelect = async () => {
    const fixture = await setup();
    await putTag(fixture.storage, { ...track, type: "single_select" });
    return fixture;
  };

  test.each([
    ["update-ticket", updateTicketCommand, { id: "T-4", tagIds: ["product", "platform"] }],
    ["set-ticket-tags", setTicketTagsCommand, { rowId: "id-T-4", tagIds: ["product", "platform"] }],
    [
      "set-ticket-attribute",
      setTicketAttributeCommand,
      { rowId: "id-T-4", attributeId: "track", value: ["product", "platform"] },
    ],
    ["create-ticket", createTicketCommand, { content: "# New", tagIds: ["product", "platform"] }],
  ])("rejects two values through %s", async (_command, command, params) => {
    const { run, tagIds } = await singleSelect();
    const before = await tagIds();

    await expect(run(command, params)).rejects.toThrow(/Track allows one value/);
    expect(await tagIds()).toEqual(before);
  });

  test("keeps tickets with an earlier conflict editable when the conflicting property is unchanged", async () => {
    const { run, tagIds } = await singleSelect();

    await run(updateTicketCommand, { id: "T-1", content: "# Edited", tagIds: ["product", "platform"] });

    expect((await tagIds())["T-1"]).toEqual(["product", "platform"]);
  });

  test("lets an earlier conflict shrink", async () => {
    const { run, storage, tagIds } = await singleSelect();
    await putTag(storage, { ...track, type: "single_select", options: [...track.options, option("docs", 2)] });
    await putTicket(storage, ticket("T-5", ["product", "platform", "docs"]));

    await run(updateTicketCommand, { id: "T-5", tagIds: ["product", "platform"] });

    expect((await tagIds())["T-5"]).toEqual(["product", "platform"]);
  });

  test("treats the earlier multi-select Type tag as single-select", async () => {
    const { run, storage } = await setup();
    const type = { ...area, id: "default-type", name: "Type", options: [option("bug", 0), option("feature", 1)] };
    await putTag(storage, type);

    await expect(run(updateTicketCommand, { id: "T-4", tagIds: ["bug", "feature"] })).rejects.toThrow(
      /Type allows one value/,
    );
  });
});
