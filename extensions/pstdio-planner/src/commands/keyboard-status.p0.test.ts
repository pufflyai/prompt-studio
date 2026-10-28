import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketCommand } from "./get-ticket";
import { changeKeyboardStatus, keyboardStatusOptions } from "./keyboard-status";

test("keyboard status updates only the explicitly chosen ticket through the normal mutation", async () => {
  const storage = createMemoryStorage();
  const a = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "A" } }));
  const b = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "B" } }));
  const options = await keyboardStatusOptions.run(...makeCommandArgs({ storage, params: {} }));
  const done = options.find((status) => status.name === "Done")!;
  await changeKeyboardStatus.run(
    ...makeCommandArgs({ storage, params: { resource: { type: "ticket", id: b.id }, statusId: done.id } }),
  );
  expect(await getTicketCommand.run(...makeCommandArgs({ storage, params: { id: a.id } }))).toMatchObject({
    statusId: a.statusId,
  });
  expect(await getTicketCommand.run(...makeCommandArgs({ storage, params: { id: b.id } }))).toMatchObject({
    statusId: done.id,
  });
});
