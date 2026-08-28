import { describe, expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { createLabInboxNotificationInput } from "../components/host-notification-card";
import { executeCounterCommand, executeSayHelloCommand, getCounterFromCommandEvent } from "./counter-api";

const createHost = () => {
  const calls: unknown[] = [];
  const host = {
    call: async (_method: string, input: unknown) => {
      calls.push(input);
      return {
        commandId: "",
        extensionId: "pstdio.extension-lab",
        outcome: {
          ok: true,
          status: "success",
          value: { counter: 1 },
        },
      };
    },
  } as GuestHost;

  return { host, calls };
};

describe("extension lab command client", () => {
  test("derives counter state from command completion events", () => {
    expect(
      getCounterFromCommandEvent({
        commandId: "pstdio.extension-lab.command.counter.bump",
        outcome: {
          ok: true,
          status: "success",
          value: { counter: 2 },
        },
        tick: 1,
      }),
    ).toBe(2);
  });

  test("ignores command events without counter state", () => {
    expect(
      getCounterFromCommandEvent({
        commandId: "pstdio.extension-lab.command.say-hello",
        outcome: {
          ok: true,
          status: "success",
          value: { message: "hello" },
        },
        tick: 1,
      }),
    ).toBeUndefined();
  });

  test("executes package-derived counter command ids", async () => {
    const { host, calls } = createHost();

    await executeCounterCommand({ host, commandId: "pstdio.extension-lab.command.counter.bump" });

    expect(calls).toEqual([
      {
        commandId: "pstdio.extension-lab.command.counter.bump",
        params: undefined,
      },
    ]);
  });

  test("executes package-derived say hello command id", async () => {
    const { host, calls } = createHost();

    await executeSayHelloCommand({ host });

    expect(calls).toEqual([
      {
        commandId: "pstdio.extension-lab.command.say-hello",
        params: undefined,
      },
    ]);
  });

  test("creates non-deduped inbox demo notifications", () => {
    expect(createLabInboxNotificationInput()).toMatchObject({
      actions: [expect.objectContaining({ command: "pstdio.extension-lab.command.say-hello", kind: "command" })],
      metadata: { demo: true },
    });
    expect(createLabInboxNotificationInput()).not.toHaveProperty("dedupeKey");
  });
});
