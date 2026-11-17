import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createCommandOptionResolver } from "./command-option-resolver";

const schema = { choice: { type: "select", options: { commandId: "choices", valueField: "id", labelField: "label" } } };
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("duplicate fields share the scoped command owner and releasing one cannot cancel the other", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", projectId: "a", extensionId: "example" });
  const pending = Promise.withResolvers<unknown>();
  let calls = 0;
  let signal: AbortSignal | undefined;
  const execute = (_id: string, _args: Record<string, unknown>, input?: AbortSignal) => {
    calls++;
    signal = input;
    return pending.promise;
  };
  const first = createCommandOptionResolver(schema, execute, () => {}, {}, queries);
  const second = createCommandOptionResolver(schema, execute, () => {}, {}, queries);
  first.update({});
  second.update({});
  expect(calls).toBe(1);
  first.dispose();
  expect(signal?.aborted).toBe(false);
  pending.resolve([]);
  await turn();
  expect(second.getSnapshot().choice).toMatchObject({ status: "ready", options: [] });
  expect(second.validate({})).toEqual({});
  second.dispose();
  queries.dispose();
});

test("option identity changes abort obsolete commands and cannot publish their late choices", async () => {
  const requests: { signal?: AbortSignal; pending: ReturnType<typeof Promise.withResolvers<unknown>> }[] = [];
  const resolver = createCommandOptionResolver(
    {
      region: { type: "text" },
      choice: {
        type: "select",
        options: {
          ...schema.choice.options,
          params: { region: { kind: "param-value", key: "region" } },
        },
      },
    },
    (_id, _args, signal) => {
      const pending = Promise.withResolvers<unknown>();
      requests.push({ signal, pending });
      return pending.promise;
    },
    () => {},
  );
  resolver.update({ region: "a" });
  resolver.update({ region: "b" });
  expect(requests[0].signal?.aborted).toBe(true);
  requests[1].pending.resolve([{ id: "b", label: "B" }]);
  await turn();
  requests[0].pending.resolve([{ id: "a", label: "A" }]);
  await turn();
  expect(resolver.getSnapshot().choice?.options).toEqual([{ value: "b", label: "B" }]);
  resolver.dispose();
});
