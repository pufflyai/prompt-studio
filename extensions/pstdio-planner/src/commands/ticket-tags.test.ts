import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readTicketTags } from "../data/tag-operations";
import { plannerTicketsChanged } from "../events";
import { makeCommandArgs } from "./command-context.fixture";
import { applyTicketTagDraftCommand, deleteTagOptionCommand, deleteTicketTagCommand } from "./ticket-tags";

for (const mode of ["option", "draft", "tag"] as const) {
  test(`publishes changed board fields after deleting a ${mode}`, async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const tag = tags[0];
    const option = tag.options[0];
    const events: unknown[] = [];
    const overrides = {
      events: {
        emit: async (event: unknown, payload: unknown) => {
          const current = (await readTicketTags(storage)).tags.find((item) => item.id === tag.id);
          if (mode === "tag") expect(current).toBeUndefined();
          else expect(current?.options.some((item) => item.id === option.id)).toBe(false);
          events.push({ event, payload });
          return { delivered: 0 };
        },
      },
    };
    if (mode === "option")
      await deleteTagOptionCommand.run(
        ...makeCommandArgs({ storage, overrides, params: { tagId: tag.id, optionId: option.id } }),
      );
    if (mode === "draft")
      await applyTicketTagDraftCommand.run(
        ...makeCommandArgs({ storage, overrides, params: { tagId: tag.id, optionIdsToDelete: [option.id] } }),
      );
    if (mode === "tag")
      await deleteTicketTagCommand.run(...makeCommandArgs({ storage, overrides, params: { tagId: tag.id } }));
    expect(events).toEqual([{ event: plannerTicketsChanged, payload: {} }]);
  });
}
