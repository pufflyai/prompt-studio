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

test("offers project cleanup in the Tickets breadcrumb menu", async () => {
  const page = createPlannerUi(import.meta.url).pages.find(({ id }) => id === "tickets");
  if (page?.main.kind !== "view" || !("tab" in page.main)) throw new Error("Expected Tickets page presentation");
  const snapshot = await page.main.tab.query();
  expect(snapshot).toMatchObject({
    menu: [
      {
        id: "tickets",
        rows: [
          {
            id: "cleanup-board",
            action: { kind: "command", target: { command: cleanupBoardCommand.ref } },
          },
        ],
      },
    ],
  });
});
