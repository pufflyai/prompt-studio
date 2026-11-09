import { expect, test } from "bun:test";
import { createLocalStoragePreferencePersistence } from "../../../storage/local-storage-preference-persistence";
import { createPreferenceRegistry, type PreferenceValue } from "./preference-registry";

const schema = { properties: { size: { type: "number", scope: "user", default: 0 } } } as const;

test("accepted preference writes retain invocation order when persistence is asynchronous", async () => {
  const first = Promise.withResolvers<void>();
  let value: PreferenceValue = 0;
  const started: PreferenceValue[] = [];
  const preferences = createPreferenceRegistry({
    persistence: {
      getValue: () => value,
      async setValue(_name, next) {
        started.push(next);
        if (next === 1) await first.promise;
        value = next;
      },
    },
  });
  preferences.registerSchema(schema);
  const one = preferences.setValue("size", 1, { scope: "user" });
  const two = preferences.setValue("size", 2, { scope: "user" });
  try {
    expect(started).toEqual([1]);
  } finally {
    first.resolve();
    await Promise.all([one, two]);
  }
  expect(preferences.getValue("size")).toBe(2);
});

test("another local adapter publishes scoped changes without a read timer", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const first = createLocalStoragePreferencePersistence(storage, "preferences");
  const second = createLocalStoragePreferencePersistence(storage, "preferences");
  const preferences = createPreferenceRegistry({ persistence: first });
  preferences.registerSchema(schema);
  const accepted: unknown[] = [];
  preferences.onDidChangeValue((name) => accepted.push([name, preferences.getValue(name)]));
  second.setValue("size", 3, { scope: "user" });
  expect(accepted).toEqual([["size", 3]]);
  await preferences.dispose?.();
  second.setValue("size", 4, { scope: "user" });
  expect(accepted).toHaveLength(1);
});

test("preference value adapters bridge their source changes and release replaced sources", async () => {
  const preferences = createPreferenceRegistry();
  preferences.registerSchema(schema);
  let value = 0;
  let emit = () => {};
  let released = 0;
  const old = preferences.registerValueAdapter("size", {
    get: () => value,
    set: (next) => {
      value = Number(next);
    },
    onDidChange(listener) {
      emit = listener;
      return () => {
        released++;
      };
    },
  });
  const accepted: unknown[] = [];
  preferences.onDidChangeValue((name) => accepted.push(preferences.getValue(name)));
  value = 1;
  emit();
  expect(accepted).toEqual([1]);
  preferences.registerValueAdapter("size", { get: () => 9, set: () => {} });
  expect(released).toBe(1);
  const beforeLateSource = accepted.length;
  emit();
  expect(accepted).toHaveLength(beforeLateSource);
  old.dispose();
  expect(preferences.getValue("size")).toBe(9);
  await preferences.dispose?.();
});

test("schema registration does not repeat an unrelated accepted value event", () => {
  const preferences = createPreferenceRegistry();
  preferences.registerSchema(schema);
  const accepted: string[] = [];
  preferences.onDidChangeValue((name) => accepted.push(name));
  preferences.setValue("size", 1, { scope: "user" });
  preferences.registerSchema({ properties: { other: { type: "number", scope: "user" } } });
  expect(accepted).toEqual(["size"]);
});

test("closing preference observation drains accepted writes without publishing or admitting more work", async () => {
  const gate = Promise.withResolvers<void>();
  const accepted: number[] = [];
  const preferences = createPreferenceRegistry({
    persistence: {
      getValue: () => 0,
      async setValue(_name, value) {
        await gate.promise;
        accepted.push(Number(value));
      },
    },
  });
  preferences.registerSchema(schema);
  let notices = 0;
  preferences.onDidChangeValue(() => notices++);
  const first = preferences.setValue("size", 1, { scope: "user" });
  const second = preferences.setValue("size", 2, { scope: "user" });
  const closed = preferences.dispose?.();
  expect(() => preferences.setValue("size", 3, { scope: "user" })).toThrow("disposed");
  gate.resolve();
  await Promise.all([first, second, closed]);
  expect(accepted).toEqual([1, 2]);
  expect(notices).toBe(0);
});
