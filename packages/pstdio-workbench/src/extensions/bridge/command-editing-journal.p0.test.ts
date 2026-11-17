import { expect, test } from "bun:test";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { createCommandEditingJournal } from "./command-editing-journal";
import { createEditingCommandQueue } from "./command-editing-types";

test("a structural acknowledgement drops incompatible optimism while preserving every ordered domain command", async () => {
  const workbench = createWorkbench();
  const hold = Promise.withResolvers<void>();
  const calls: unknown[] = [];
  const member = {
    id: "member",
    events: createHostEventPublisher(),
    workbench,
    execute: async (input: unknown) => {
      calls.push(input);
      if (calls.length === 1) {
        await hold.promise;
        return { value: { point: null } };
      }
      return { value: { point: { x: 1 } } };
    },
  };
  const journal = createCommandEditingJournal({
    command: { commandId: "example.command.edit" },
    serialize: createEditingCommandQueue(),
    accepted: () => {},
    changed: () => {
      journal.snapshot();
    },
  });
  try {
    journal.accept({ value: { point: { x: 0 } } });
    const a = journal.execute(member, {
      operation: "execute",
      sessionId: "member",
      sequence: 1,
      params: { type: "undo" },
      changes: [],
    });
    const b = journal.execute(member, {
      operation: "execute",
      sessionId: "member",
      sequence: 2,
      params: { type: "move", x: 1 },
      changes: [{ path: ["point", "x"], value: 1 }],
    });
    await Bun.sleep(0);
    expect(calls).toHaveLength(1);
    hold.resolve();
    await Promise.all([a, b]);
    expect(calls).toHaveLength(2);
    expect(journal.snapshot()).toMatchObject({
      value: { point: { x: 1 } } as JsonObject,
      savedRevision: 2,
      pendingCommands: 0,
    });
  } finally {
    hold.resolve();
    await workbench.dispose();
  }
});
