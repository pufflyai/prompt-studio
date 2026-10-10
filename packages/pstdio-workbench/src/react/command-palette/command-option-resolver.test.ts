import { expect, test } from "bun:test";
import { createCommandOptionResolver } from "./command-option-resolver";
import {
  buildCommandParamInitialValues,
  listCommandParamEntries,
  mergeCommandParamArgs,
  normalizeCommandParamValues,
  resolveCommandResourceParams,
} from "./command-palette-params";

const source = {
  commandId: "locales",
  valueField: "id",
  labelField: "name",
  params: { region: { kind: "param-value", key: "region" } },
};
const schema = { region: { type: "text" }, locale: { type: "select", options: source } };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("shows invalid editable JSON dependencies as option errors", async () => {
  const resolver = createCommandOptionResolver(
    {
      region: { type: "json" },
      locale: { type: "select", options: source },
    },
    async () => [],
    () => {},
  );
  expect(() => resolver.update({ region: "{" })).not.toThrow();
  await tick();
  expect(resolver.getSnapshot().locale).toMatchObject({ status: "error", error: "Invalid JSON for Region" });
  expect(resolver.validate({ region: "{" })).toHaveProperty("locale");
  resolver.dispose();
});

test("shares hidden resource values with dependent choices and submission across resources", async () => {
  const schema = {
    instance: { type: "resource", resourceType: "instance", required: true, resolvedFrom: "resource" as const },
    template: {
      type: "select",
      options: { ...source, params: { instance: { kind: "param-value", key: "instance" } } },
    },
  };
  const requests: unknown[] = [];
  expect(listCommandParamEntries(schema).map((entry) => entry.key)).toEqual(["template"]);
  const keys: string[] = [];
  for (const id of ["first", "second"]) {
    const context = { resource: { type: "instance", id } };
    const resolved = resolveCommandResourceParams(schema, undefined, context);
    const values = buildCommandParamInitialValues(schema, undefined, context);
    const resolver = createCommandOptionResolver(
      schema,
      async (_id, args) => {
        requests.push(args);
        return [];
      },
      () => {},
      resolved,
    );
    resolver.update(values);
    await tick();
    expect(requests.at(-1)).toEqual({ instance: { type: "instance", id } });
    expect(
      mergeCommandParamArgs(undefined, { ...resolved, ...normalizeCommandParamValues(schema, values) }, schema),
    ).toEqual({ instance: { type: "instance", id } });
    keys.push(resolver.getSnapshot().template!.key);
    resolver.dispose();
  }
  expect(requests).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});

test("refreshes dependent options, clears missing selections and ignores late results", async () => {
  const requests: Array<{ args: unknown; resolve: (value: unknown) => void }> = [];
  const cleared: unknown[] = [];
  const resolver = createCommandOptionResolver(
    schema,
    (_id, args) => new Promise((resolve) => requests.push({ args, resolve })),
    (key, value) => cleared.push({ key, value }),
  );
  resolver.update({ region: "eu", locale: "de" });
  resolver.update({ region: "us", locale: "de" });
  expect(requests.map((r) => r.args)).toEqual([{ region: "eu" }, { region: "us" }]);
  requests[1]!.resolve([{ id: "en", name: "English" }]);
  await tick();
  requests[0]!.resolve([{ id: "de", name: "German" }]);
  await tick();
  expect(resolver.getSnapshot().locale).toMatchObject({
    status: "ready",
    options: [{ value: "en", label: "English" }],
  });
  expect(cleared).toEqual([{ key: "locale", value: "" }]);
  expect(resolver.validate({ region: "us", locale: "de" })).toEqual({
    locale: "Choose a value from the available options.",
  });
  resolver.dispose();
});

test("exposes failures, retries and empty results without treating errors as choices", async () => {
  let calls = 0;
  const resolver = createCommandOptionResolver(
    schema,
    async () => {
      if (++calls === 1) throw new Error("Offline");
      return [];
    },
    () => {},
  );
  resolver.update({ region: "eu" });
  await tick();
  expect(resolver.getSnapshot().locale).toMatchObject({ status: "error", error: "Offline" });
  expect(resolver.validate({ region: "eu" })).toHaveProperty("locale");
  resolver.retry("locale");
  await tick();
  expect(resolver.getSnapshot().locale).toMatchObject({ status: "ready", options: [] });
  resolver.dispose();
});

test("does not publish after disposal and permits explicitly declared custom values", async () => {
  let finish: (value: unknown) => void = () => {};
  const resolver = createCommandOptionResolver(
    { ...schema, locale: { ...schema.locale, allowCustomValues: true } },
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {
      throw new Error("must not clear custom values");
    },
  );
  resolver.update({ region: "eu", locale: "custom" });
  finish([]);
  await tick();
  expect(resolver.validate({ region: "eu", locale: "custom" })).toEqual({});
  resolver.update({ region: "us", locale: "custom" });
  resolver.dispose();
  const pending = resolver.getSnapshot();
  finish([]);
  await tick();
  expect(resolver.getSnapshot()).toBe(pending);
});

test("passes typed sibling values and cancels superseded requests", async () => {
  const requests: Array<{ args: unknown; signal?: AbortSignal }> = [];
  const resolver = createCommandOptionResolver(
    {
      count: { type: "number" },
      locale: { type: "select", options: { ...source, params: { limit: { kind: "param-value", key: "count" } } } },
    },
    async (_id, args, signal) => {
      requests.push({ args, signal });
      return [];
    },
    () => {},
  );
  resolver.update({ count: "2" });
  await tick();
  resolver.update({ count: "3" });
  await tick();
  expect(requests.map((request) => request.args)).toEqual([{ limit: 2 }, { limit: 3 }]);
  expect(requests[0]?.signal?.aborted).toBe(true);
  resolver.dispose();
  expect(requests[1]?.signal?.aborted).toBe(true);
});

test("keeps available multi-select choices when dependencies change", async () => {
  const cleared: unknown[] = [];
  const resolver = createCommandOptionResolver(
    { ...schema, locale: { type: "multi-select", options: source } },
    async () => [{ id: "en", name: "English" }],
    (key, value) => cleared.push({ key, value }),
  );
  resolver.update({ region: "us", locale: ["en", "de"] });
  await tick();
  expect(cleared).toEqual([{ key: "locale", value: ["en"] }]);
  expect(resolver.validate({ region: "us", locale: ["en"] })).toEqual({});
  resolver.dispose();
});
