import { describe, expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { executeCounterCommand, executeSayHelloCommand } from "./counter-api";

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
  test("executes package-derived counter command ids", async () => {
    const { host, calls } = createHost();

    await executeCounterCommand({ host, commandId: "extension-lab.counter.bump" });

    expect(calls).toEqual([
      {
        commandId: "extension-lab.counter.bump",
        params: undefined,
      },
    ]);
  });

  test("executes package-derived say hello command id", async () => {
    const { host, calls } = createHost();

    await executeSayHelloCommand({ host });

    expect(calls).toEqual([
      {
        commandId: "extension-lab.say-hello",
        params: undefined,
      },
    ]);
  });
});
