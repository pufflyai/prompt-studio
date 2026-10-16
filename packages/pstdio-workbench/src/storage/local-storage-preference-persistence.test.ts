import { expect, test } from "bun:test";
import { createWorkbench } from "../core";
import { createLocalStorageWorkbenchPersistence } from "./local-storage-persistence";

test("user preferences keep an explicit false value across workbench reloads", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = () => {
    const workbench = createWorkbench(createLocalStorageWorkbenchPersistence({ namespace: "test", storage }));
    workbench.preferences.registerSchema({
      properties: { related: { type: "boolean", scope: "user", default: true } },
    });
    return workbench;
  };
  const first = create();
  expect(first.preferences.getValue("related")).toBe(true);
  await first.preferences.setValue("related", false, { scope: "user" });
  expect(create().preferences.getValue("related")).toBe(false);
});
