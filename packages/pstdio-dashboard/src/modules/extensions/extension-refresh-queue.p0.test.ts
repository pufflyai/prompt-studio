import { expect, test } from "bun:test";
import { createExtensionRefreshQueue } from "./extension-refresh-queue";

test("a queued refresh failure completes readiness after the chain applied valid metadata", async () => {
  const first = Promise.withResolvers<string>();
  const second = Promise.withResolvers<string>();
  const completed: string[] = [];
  let calls = 0;
  const values: string[] = [];
  const queue = createExtensionRefreshQueue({
    getGeneration: () => 1,
    getProjectId: () => "project",
    fallback: () => "fallback",
    load: () => (++calls === 1 ? first.promise : second.promise),
    apply: (_project, value) => values.push(value),
    onComplete: (project) => completed.push(project),
  });
  queue.refresh("project");
  queue.refresh("project");
  first.resolve("valid");
  await new Promise(setImmediate);
  expect(calls).toBe(2);
  expect(values).toEqual(["valid"]);
  second.reject(new Error("offline"));
  await new Promise(setImmediate);
  expect(completed).toEqual(["project"]);
});
