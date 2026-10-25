import { describe, expect, test } from "bun:test";
import type { ExtensionLoggerApi } from "@pstdio/sdk/extensions";
import { createInvocationScope } from "./scope";

const recordingLogger = () => {
  const warnings: string[] = [];
  const logger: ExtensionLoggerApi = {
    info: () => {},
    warn: (message) => warnings.push(message),
    error: () => {},
  };
  return { logger, warnings };
};

describe("invocation scope", () => {
  test("releases resources in reverse order", async () => {
    const { logger } = recordingLogger();
    const scope = createInvocationScope({ logger });
    const order: string[] = [];

    scope.register(() => {
      order.push("first");
    });
    scope.register(() => {
      order.push("second");
    });

    await scope.close();

    expect(order).toEqual(["second", "first"]);
  });

  test("does not cancel work the invocation handed to the host", async () => {
    const { logger } = recordingLogger();
    const scope = createInvocationScope({ logger });

    // Commands start work the host keeps running after they return, such as an agent
    // session. Closing the scope releases what the invocation owns, and nothing else.
    await scope.close();

    expect(scope.signal.aborted).toBe(false);
  });

  test("releases every resource once", async () => {
    const { logger } = recordingLogger();
    const scope = createInvocationScope({ logger });
    let released = 0;

    scope.register(() => {
      released += 1;
    });

    await scope.close();
    await scope.close();

    expect(released).toBe(1);
  });

  test("keeps releasing after a disposer throws and reports the failure", async () => {
    const { logger, warnings } = recordingLogger();
    const scope = createInvocationScope({ logger });
    let released = false;

    scope.register(() => {
      released = true;
    });
    scope.register(() => {
      throw new Error("disposer exploded");
    });

    await scope.close();

    expect(released).toBe(true);
    expect(warnings).toEqual(["Invocation cleanup failed: disposer exploded"]);
  });

  test("releases a resource registered after it closed", async () => {
    const { logger } = recordingLogger();
    const scope = createInvocationScope({ logger });
    let released = false;

    await scope.close();
    scope.register(() => {
      released = true;
    });
    await Bun.sleep(0);

    expect(released).toBe(true);
  });

  test("releases resources as soon as the host cancels, without waiting to be closed", async () => {
    const { logger } = recordingLogger();
    const parent = new AbortController();
    const scope = createInvocationScope({ logger, parent: parent.signal });
    let released = false;
    scope.register(() => {
      released = true;
    });

    // A handler that ignores cancellation must not hold host resources open forever.
    parent.abort(new Error("cancelled"));
    await Bun.sleep(0);

    expect(released).toBe(true);
  });

  test("aborts with the parent reason when the host cancels the invocation", () => {
    const { logger } = recordingLogger();
    const parent = new AbortController();
    const scope = createInvocationScope({ logger, parent: parent.signal });

    parent.abort(new Error("cancelled"));

    expect(scope.signal.aborted).toBe(true);
    expect((scope.signal.reason as Error).message).toBe("cancelled");
  });

  test("starts aborted when the parent was already cancelled", () => {
    const { logger } = recordingLogger();
    const parent = new AbortController();
    parent.abort(new Error("already cancelled"));

    const scope = createInvocationScope({ logger, parent: parent.signal });

    expect(scope.signal.aborted).toBe(true);
  });
});
