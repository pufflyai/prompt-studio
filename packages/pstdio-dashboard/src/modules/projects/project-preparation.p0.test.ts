import { expect, test } from "bun:test";
import { createProjectPreparation } from "./project-preparation";

test("download completion during a status read still prepares the selected project", async () => {
  const first = Promise.withResolvers<{ state: string; offlineReady: boolean }>();
  let reads = 0;
  const opened: string[] = [];
  const preparation = createProjectPreparation({
    selected: () => "project",
    ready: () => false,
    status: async () => (++reads === 1 ? first.promise : { state: "synced", offlineReady: true }),
    open: async (id) => {
      opened.push(id);
    },
    failed: (error) => {
      throw error;
    },
  });
  const reading = preparation.refresh();
  preparation.refresh();
  first.resolve({ state: "first-download-incomplete", offlineReady: false });
  await reading;
  expect(reads).toBe(2);
  expect(opened).toEqual(["project"]);
});

test("switching projects during a read cannot prepare the outgoing project", async () => {
  const status = Promise.withResolvers<{ state: string; offlineReady: boolean }>();
  let selected = "old";
  const opened: string[] = [];
  const preparation = createProjectPreparation({
    selected: () => selected,
    ready: () => false,
    status: () => status.promise,
    open: async (id) => {
      opened.push(id);
    },
    failed: () => {},
  });
  const reading = preparation.refresh();
  selected = "new";
  status.resolve({ state: "synced", offlineReady: true });
  await reading;
  expect(opened).toEqual([]);
});

test("a sync update during a failed status read is read again before reporting failure", async () => {
  const first = Promise.withResolvers<{ state: string; offlineReady: boolean }>();
  let reads = 0;
  const opened: string[] = [];
  const errors: unknown[] = [];
  const preparation = createProjectPreparation({
    selected: () => "project",
    ready: () => false,
    status: async () => (++reads === 1 ? first.promise : { state: "synced", offlineReady: true }),
    open: async (id) => {
      opened.push(id);
    },
    failed: (error) => {
      errors.push(error);
    },
  });
  const reading = preparation.refresh();
  preparation.refresh();
  first.reject(new Error("connection interrupted"));
  await reading;
  expect(reads).toBe(2);
  expect(opened).toEqual(["project"]);
  expect(errors).toEqual([]);
});
