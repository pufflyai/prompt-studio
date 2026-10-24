import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTag, tagsCollection } from "../data/collections";
import { putTicket, ticketsCollection } from "../data/ticket-context.fixture";
import type { StoredTag, StoredTicketTags, Ticket } from "../data/types";
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

const ticket = (shorthand: string, tags: StoredTicketTags, overrides: Partial<Ticket> = {}): Ticket => ({
  id: `id-${shorthand}`,
  shorthand,
  title: shorthand,
  content: `# ${shorthand}`,
  statusId: null,
  tags,
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
  await putTicket(storage, ticket("T-1", { track: ["product", "platform"], area: ["ui"] }));
  await putTicket(storage, ticket("T-2", { track: ["product", "platform"] }, { archived: true }));
  await putTicket(storage, ticket("T-3", { track: ["platform", "product"] }, { draft: true }));
  await putTicket(storage, ticket("T-4", { track: ["platform"] }));
  const run = <T extends { run: (...args: never[]) => unknown }>(command: T, params: Record<string, unknown>) =>
    (command.run as (...args: unknown[]) => Promise<unknown>)(...makeCommandArgs({ storage, params }));
  const storedTags = async () =>
    Object.fromEntries((await ticketsCollection(storage).list()).map((stored) => [stored.shorthand, stored.tags]));
  return { run, storage, storedTags };
};

describe("changing a property to single-select", () => {
  test.each([
    ["the public update command", updateTicketTagCommand],
    ["the settings draft", applyTicketTagDraftCommand],
  ])("names every conflicting ticket and changes nothing through %s", async (_path, command) => {
    const { run, storage, storedTags } = await setup();
    const before = await storedTags();

    const change = run(command, { tagId: "track", type: "single_select" });

    await expect(change).rejects.toThrow(/T-1, T-2, T-3/);
    await expect(change).rejects.not.toThrow(/T-4/);
    expect((await tagsCollection(storage).get("track"))?.type).toBe("multi_select");
    expect(await storedTags()).toEqual(before);
  });

  test("succeeds after each conflict is resolved, stores one value, and keeps every other assignment", async () => {
    const { run, storage, storedTags } = await setup();
    for (const [rowId, value] of [
      ["id-T-1", "product"],
      ["id-T-2", "platform"],
      ["id-T-3", "product"],
    ]) {
      await run(setTicketAttributeCommand, { rowId, attributeId: "track", value });
    }

    await run(updateTicketTagCommand, { tagId: "track", type: "single_select" });

    expect(await tagsCollection(storage).get("track")).toEqual({ ...track, type: "single_select" });
    expect(await storedTags()).toEqual({
      "T-1": { area: ["ui"], track: "product" },
      "T-2": { track: "platform" },
      "T-3": { track: "product" },
      "T-4": { track: "platform" },
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
    const { run, storedTags } = await singleSelect();
    const before = await storedTags();

    await expect(run(command, params)).rejects.toThrow(/Track allows one value/);
    expect(await storedTags()).toEqual(before);
  });

  // Another device can change the tag's type while this ticket still holds a list.
  test("replaces a list left on a single-select with the chosen value", async () => {
    const { run, storedTags } = await singleSelect();

    await run(setTicketAttributeCommand, { rowId: "id-T-1", attributeId: "track", value: "platform" });

    expect((await storedTags())["T-1"]).toEqual({ track: "platform", area: ["ui"] });
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
