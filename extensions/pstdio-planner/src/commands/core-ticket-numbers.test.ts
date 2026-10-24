import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketCommand } from "./get-ticket";

test("ticket records store the core ID and reads use its current number", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Offline ticket" });
  const stored = await storage.collection("tickets").get(ticket.id);
  expect(stored).not.toHaveProperty("shorthand");
  ctx.resources.identity = async () => ({ id: ticket.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] });
  expect(await getTicketCommand.run(ctx, { id: ticket.id })).toMatchObject({ id: ticket.id, shorthand: "T-2" });
});

test("an old number uses core aliases and a shared alias returns every ticket", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const identities = [
    { id: first.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] },
    { id: second.id, kind: "ticket", shorthand: "T-3", aliases: ["T-1"] },
  ];
  ctx.resources.identity = async ({ id }) => identities.find((entry) => entry.id === id) ?? null;
  ctx.resources.findByShorthand = async ({ shorthand }) =>
    identities.filter((entry) => entry.shorthand === shorthand || entry.aliases.includes(shorthand));
  expect(await getTicketCommand.run(ctx, { id: "T-1" })).toMatchObject([
    { id: first.id, shorthand: "T-2" },
    { id: second.id, shorthand: "T-3" },
  ]);
  expect(await getTicketCommand.run(ctx, { id: "T-2" })).toMatchObject({ id: first.id, shorthand: "T-2" });
});

test("a shared alias path opens all matching tickets", async () => {
  const { resolveTicketPathCommand } = await import("./resolve-ticket-path");
  const { ticketMarkdownPath } = await import("../data/draft-storage");
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const identities = [
    { id: first.id, kind: "ticket", shorthand: "T-1", aliases: [] },
    { id: second.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] },
  ];
  ctx.resources.identity = async ({ id }) => identities.find((entry) => entry.id === id) ?? null;
  ctx.resources.findByShorthand = async () => identities;
  expect(
    await resolveTicketPathCommand.run(ctx, { path: ticketMarkdownPath("T-1"), workspaceId: "workspace" }),
  ).toMatchObject({
    target: {
      kind: "compound",
      targets: [{ resource: { id: first.id, shorthand: "T-1" } }, { resource: { id: second.id, shorthand: "T-2" } }],
    },
  });
});

test("read commands show every ticket matched by a shared alias", async () => {
  const { listTicketFilesCommand } = await import("./list-ticket-files");
  const { listTicketsCommand } = await import("./list-tickets");
  const { documentLinkCommand } = await import("./document-link");
  const { ticketWorkspacesCommand } = await import("./ticket-workspaces");
  const { queryTicketResources } = await import("./query-ticket-resources");
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { projectFiles: createMemoryRepoFiles() } });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  await createTicketCommand.run(ctx, { title: "First child", parentId: first.id });
  await createTicketCommand.run(ctx, { title: "Second child", parentId: second.id });
  const coreIdentity = ctx.resources.identity;
  const coreLookup = ctx.resources.findByShorthand;
  const secondIdentity = { id: second.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] };
  ctx.resources.identity = (input) => (input.id === second.id ? Promise.resolve(secondIdentity) : coreIdentity(input));
  ctx.resources.findByShorthand = async (input) =>
    input.shorthand === "T-1" ? [...(await coreLookup(input)), secondIdentity] : coreLookup(input);
  expect(await listTicketFilesCommand.run(ctx, { id: "T-1" })).toMatchObject([
    { id: first.id, shorthand: "T-1", files: [] },
    { id: second.id, shorthand: "T-2", files: [] },
  ]);
  expect((await listTicketsCommand.run(ctx, { parent: "T-1" })).map(({ title }) => title)).toEqual([
    "First child",
    "Second child",
  ]);
  expect(await documentLinkCommand.run(ctx, { id: "T-1" })).toMatchObject([{ id: first.id }, { id: second.id }]);
  ctx.workspaces.list = async () =>
    [first, second].map((ticket, index) => ({
      id: `workspace-${index}`,
      anchors_json: [{ type: "ticket", id: ticket.id }],
    }));
  expect(await ticketWorkspacesCommand.run(ctx, { id: "T-1" })).toHaveLength(2);
  const search = await queryTicketResources(ctx, {
    query: "T-1",
    providerId: "tickets",
    limit: 10,
    renderer: { rendererId: "tickets" },
  });
  expect(search.items.map(({ id }) => id)).toEqual([first.id, second.id]);
  const { createTicketFileCommand } = await import("./ticket-files");
  const file = await createTicketFileCommand.run(ctx, { ticketId: first.id, name: "research.md" });
  expect(await documentLinkCommand.run(ctx, { id: "T-1", file: file.name })).toMatchObject([{ id: first.id }]);
});

test("saving a ticket keeps relationships whose old number became a shared alias", async () => {
  const { pullTicketCommand } = await import("./pull-ticket");
  const { saveTicketCommand } = await import("./save-ticket");
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { projectFiles: createMemoryRepoFiles() } });
  const parent = await createTicketCommand.run(ctx, { title: "Parent" });
  const dependency = await createTicketCommand.run(ctx, { title: "Dependency" });
  const other = await createTicketCommand.run(ctx, { title: "Other device ticket" });
  const child = await createTicketCommand.run(ctx, {
    title: "Child",
    parentId: parent.id,
    dependsOn: [dependency.shorthand],
  });
  await pullTicketCommand.run(ctx, { id: child.id });
  // An offline merge renumbers the parent and dependency; their old numbers are now shared with another ticket.
  const identities = [
    { id: parent.id, kind: "ticket", shorthand: "T-5", aliases: [parent.shorthand] },
    { id: dependency.id, kind: "ticket", shorthand: "T-6", aliases: [dependency.shorthand] },
    { id: other.id, kind: "ticket", shorthand: "T-7", aliases: [parent.shorthand, dependency.shorthand] },
    { id: child.id, kind: "ticket", shorthand: child.shorthand, aliases: [] },
  ];
  ctx.resources.identity = async ({ id }) => identities.find((entry) => entry.id === id) ?? null;
  ctx.resources.identityMany = async ({ ids }) => ids.map((id) => identities.find((entry) => entry.id === id) ?? null);
  ctx.resources.findByShorthand = async ({ shorthand }) =>
    identities.filter((entry) => entry.shorthand === shorthand || entry.aliases.includes(shorthand));
  await saveTicketCommand.run(ctx, { id: child.id });
  expect(await storage.collection("tickets").get(child.id)).toMatchObject({
    parentId: parent.id,
    dependsOn: [dependency.id],
  });
  const { updateTicketCommand } = await import("./update-ticket");
  await updateTicketCommand.run(ctx, { id: child.id, parent: parent.shorthand, dependsOn: [dependency.shorthand] });
  expect(await storage.collection("tickets").get(child.id)).toMatchObject({
    parentId: parent.id,
    dependsOn: [dependency.id],
  });
});
