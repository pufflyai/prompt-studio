import { expect, test } from "bun:test";
import { makeCommandContext } from "./command-context";
import { createMemoryStorage } from "./memory-storage";

test("each context allocates with its own resource prefixes", async () => {
  const storage = createMemoryStorage();

  const first = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "T" } });
  const second = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });

  expect((await first.resources.allocate({ kind: "ticket" })).shorthand).toBe("T-1");
  expect((await second.resources.allocate({ kind: "ticket" })).shorthand).toBe("PS-2");
});
