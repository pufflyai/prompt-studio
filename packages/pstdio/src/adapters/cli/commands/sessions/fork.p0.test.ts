import { expect, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./fork";

test("fork prints the independent session returned by the API", async () => {
  const output: string[] = [];
  const ids: string[] = [];
  const handler = createHandler({
    forkSession: async (id) => {
      ids.push(id);
      return { id: "new-session", originalSessionId: id } as Awaited<
        ReturnType<typeof import("@/features/sessions/api/fork-session").forkSession>
      >;
    },
    log: (value) => output.push(value),
  });
  await handler({ id: "source", _: [], $0: "pst" } as Arguments<{ id: string }>);
  expect(ids).toEqual(["source"]);
  expect(JSON.parse(output[0])).toEqual({ id: "new-session", originalSessionId: "source" });
});
