import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { saveOwnedTemplate } from "../data/template-store";
import { createPlannerUi } from "../ui-contributions";
import { cleanupBoardCommand } from "./cleanup-board";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";

test("starts project cleanup with the selected model and editable prompt, without a ticket anchor", async () => {
  const sessions: unknown[] = [];
  const navigations: unknown[] = [];
  const session = createSessionResource();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: { type: "ticket", id: "unrelated-ticket" },
      navigation: {
        open: (target) => {
          navigations.push(target);
        },
      },
      sessions: {
        create: async (input) => {
          sessions.push(input);
          return session;
        },
      },
    },
  });
  await saveOwnedTemplate(ctx, { name: "cleanup-board", type: "prompt", content: "Project cleanup override" });
  expect(await cleanupBoardCommand.run(ctx, { agent: { harnessId: "codex", model: "selected-model" } })).toEqual(
    session,
  );
  expect(sessions).toEqual([
    {
      title: "Cleanup board",
      harness: { harnessId: "codex", model: "selected-model" },
      prompt: "Project cleanup override",
    },
  ]);
  expect(navigations).toEqual([
    expect.objectContaining({
      kind: "panel",
      resource: expect.objectContaining({ type: "session", id: session.id }),
    }),
  ]);
});

test("offers project cleanup from the Tickets toolbar without requiring a selected ticket", () => {
  const tickets = createPlannerUi(import.meta.url).views.find(({ id }) => id === "tickets");
  expect(tickets?.body).toMatchObject({
    kind: "kanban",
    toolbarActions: [
      expect.objectContaining({
        id: "cleanup-board",
        command: cleanupBoardCommand.ref,
        input: { agent: expect.objectContaining({ type: "harness" }) },
      }),
    ],
  });
});
